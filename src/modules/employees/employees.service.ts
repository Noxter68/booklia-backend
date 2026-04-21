import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  GetAvailableSlotsDto,
  CreateEmployeeExceptionDto,
  ListEmployeeExceptionsDto,
} from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateEmployeeDto) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const { availabilities, serviceIds, ...employeeData } = dto;

    const employee = await this.prisma.employee.create({
      data: {
        ...employeeData,
        businessId: business.id,
        availabilities: availabilities
          ? {
              create: availabilities,
            }
          : undefined,
        services: serviceIds
          ? {
              create: serviceIds.map((id) => ({
                businessServiceId: id,
              })),
            }
          : undefined,
      },
      include: {
        availabilities: true,
        services: {
          include: {
            businessService: true,
          },
        },
      },
    });

    return employee;
  }

  async findByBusiness(businessId: string) {
    return this.prisma.employee.findMany({
      where: { businessId },
      include: {
        availabilities: true,
        services: {
          include: {
            businessService: true,
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });
  }

  async findById(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        business: true,
        availabilities: true,
        services: {
          include: {
            businessService: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employé non trouvé');
    }

    return employee;
  }

  async update(userId: string, employeeId: string, dto: UpdateEmployeeDto) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.businessId !== business.id) {
      throw new ForbiddenException('Accès refusé');
    }

    const { availabilities, serviceIds, ...employeeData } = dto;

    // Update employee with new data
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update availabilities if provided
      if (availabilities) {
        await tx.employeeAvailability.deleteMany({
          where: { employeeId },
        });
        await tx.employeeAvailability.createMany({
          data: availabilities.map((a) => ({
            ...a,
            employeeId,
          })),
        });
      }

      // Update services if provided
      if (serviceIds) {
        await tx.employeeService.deleteMany({
          where: { employeeId },
        });
        await tx.employeeService.createMany({
          data: serviceIds.map((id) => ({
            employeeId,
            businessServiceId: id,
          })),
        });
      }

      // Update employee data
      return tx.employee.update({
        where: { id: employeeId },
        data: employeeData,
        include: {
          availabilities: true,
          services: {
            include: {
              businessService: true,
            },
          },
        },
      });
    });

    return updated;
  }

  async delete(userId: string, employeeId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.businessId !== business.id) {
      throw new ForbiddenException('Accès refusé');
    }

    await this.prisma.employee.delete({
      where: { id: employeeId },
    });

    return { success: true };
  }

  async getAvailableSlots(dto: GetAvailableSlotsDto) {
    const { employeeId, businessServiceId, date } = dto;

    // Get employee with ALL weekly availability slots (multiple per day now allowed)
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        availabilities: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employé non trouvé');
    }

    // Get service duration
    const service = await this.prisma.businessService.findUnique({
      where: { id: businessServiceId },
    });

    if (!service) {
      throw new NotFoundException('Service non trouvé');
    }

    // Parse date as local time (add T00:00:00 to avoid UTC interpretation)
    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const dayOfWeek = targetDate.getDay();

    // Check for a date-specific exception (closure or custom time slots).
    // @db.Date columns expect midnight UTC; pass the same instant in all envs.
    const exceptionDate = new Date(Date.UTC(year, month - 1, day));
    const exception = await this.prisma.employeeException.findUnique({
      where: { employeeId_date: { employeeId, date: exceptionDate } },
      include: { slots: true },
    });

    // If explicitly closed on that date, no slots available
    if (exception?.isClosed) {
      return { slots: [] };
    }

    // Resolve effective time ranges. An exception with slots overrides the
    // weekly schedule entirely; otherwise fall back to the weekly rows.
    type Range = { startTime: string; endTime: string };
    let ranges: Range[];
    if (exception && exception.slots.length > 0) {
      ranges = exception.slots.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
      }));
    } else {
      ranges = employee.availabilities
        .filter((a) => a.dayOfWeek === dayOfWeek)
        .map((a) => ({ startTime: a.startTime, endTime: a.endTime }));
    }

    if (ranges.length === 0) {
      return { slots: [] };
    }

    // Get existing bookings for this employee on this date
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        employeeId,
        scheduledAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      include: {
        businessService: { select: { durationMinutes: true } },
      },
    });

    // Helpers
    const slotDuration = service.durationMinutes;
    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };

    // Today's cutoff so past slots appear as unavailable
    const now = new Date();
    const isToday =
      now.getFullYear() === year &&
      now.getMonth() === month - 1 &&
      now.getDate() === day;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Generate slots for each range, then merge + sort + dedupe
    const slotsMap = new Map<string, { time: string; available: boolean }>();

    for (const { startTime, endTime } of ranges) {
      const startMin = toMinutes(startTime);
      const endMin = toMinutes(endTime);
      if (endMin <= startMin) continue; // defensive

      for (let cur = startMin; cur + slotDuration <= endMin; cur += 30) {
        const hour = Math.floor(cur / 60);
        const min = cur % 60;
        const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

        const isPast = isToday && cur <= nowMinutes;

        const slotStart = new Date(year, month - 1, day, hour, min, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

        const isBooked = existingBookings.some((booking) => {
          if (!booking.scheduledAt) return false;
          let bookingEnd = booking.scheduledEndAt;
          if (!bookingEnd && booking.businessService?.durationMinutes) {
            bookingEnd = new Date(
              booking.scheduledAt.getTime() +
                booking.businessService.durationMinutes * 60000,
            );
          }
          if (!bookingEnd) return false;
          return slotStart < bookingEnd && slotEnd > booking.scheduledAt;
        });

        slotsMap.set(timeStr, { time: timeStr, available: !isBooked && !isPast });
      }
    }

    const slots = Array.from(slotsMap.values()).sort((a, b) =>
      a.time.localeCompare(b.time),
    );

    return { slots };
  }

  // ============================================
  // EMPLOYEE EXCEPTIONS
  // ============================================

  /**
   * Assert the user owning the business can manage this employee.
   * Throws if not found or not allowed.
   */
  private async assertCanManageEmployee(userId: string, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { business: { select: { ownerId: true } } },
    });
    if (!employee) throw new NotFoundException('Employé non trouvé');
    if (employee.business.ownerId !== userId) {
      throw new ForbiddenException('Accès refusé');
    }
    return employee;
  }

  /** Convert "YYYY-MM-DD" string to the UTC-midnight Date Prisma expects for @db.Date. */
  private parseDateOnly(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) throw new BadRequestException(`Date invalide: ${s}`);
    return new Date(Date.UTC(y, m - 1, d));
  }

  async listExceptions(
    userId: string,
    employeeId: string,
    dto: ListEmployeeExceptionsDto,
  ) {
    await this.assertCanManageEmployee(userId, employeeId);
    const where: any = { employeeId };
    if (dto.from || dto.to) {
      where.date = {};
      if (dto.from) where.date.gte = this.parseDateOnly(dto.from);
      if (dto.to) where.date.lte = this.parseDateOnly(dto.to);
    }
    return this.prisma.employeeException.findMany({
      where,
      orderBy: { date: 'asc' },
      include: { slots: { orderBy: { startTime: 'asc' } } },
    });
  }

  async createException(
    userId: string,
    employeeId: string,
    dto: CreateEmployeeExceptionDto,
  ) {
    await this.assertCanManageEmployee(userId, employeeId);

    // Build list of dates to cover (single day or inclusive range)
    const dates: Date[] = [];
    if (dto.date) {
      dates.push(this.parseDateOnly(dto.date));
    } else if (dto.dateFrom && dto.dateTo) {
      const start = this.parseDateOnly(dto.dateFrom);
      const end = this.parseDateOnly(dto.dateTo);
      if (start > end) {
        throw new BadRequestException('dateFrom doit être <= dateTo');
      }
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        dates.push(new Date(d));
      }
    } else {
      throw new BadRequestException(
        'Fournissez soit `date`, soit `dateFrom` + `dateTo`',
      );
    }

    // Validate slots when not closed
    const slots = dto.slots ?? [];
    if (!dto.isClosed && slots.length === 0) {
      throw new BadRequestException(
        'Au moins une plage horaire est requise pour des horaires spéciaux',
      );
    }
    for (const s of slots) {
      if (!/^\d{2}:\d{2}$/.test(s.startTime) || !/^\d{2}:\d{2}$/.test(s.endTime)) {
        throw new BadRequestException('Format d\'heure invalide (attendu HH:MM)');
      }
      if (s.startTime >= s.endTime) {
        throw new BadRequestException('startTime doit être < endTime');
      }
    }

    // Upsert each day atomically: replace slots entirely each time
    const created = await this.prisma.$transaction(
      dates.map((date) =>
        this.prisma.employeeException.upsert({
          where: { employeeId_date: { employeeId, date } },
          create: {
            employeeId,
            date,
            isClosed: dto.isClosed,
            reason: dto.reason,
            slots: dto.isClosed
              ? undefined
              : { create: slots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })) },
          },
          update: {
            isClosed: dto.isClosed,
            reason: dto.reason,
            // Wipe previous slots and recreate from scratch
            slots: {
              deleteMany: {},
              create: dto.isClosed
                ? []
                : slots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
            },
          },
          include: { slots: true },
        }),
      ),
    );

    return created;
  }

  async deleteException(userId: string, exceptionId: string) {
    const exception = await this.prisma.employeeException.findUnique({
      where: { id: exceptionId },
      include: {
        employee: {
          include: { business: { select: { ownerId: true } } },
        },
      },
    });
    if (!exception) throw new NotFoundException('Exception non trouvée');
    if (exception.employee.business.ownerId !== userId) {
      throw new ForbiddenException('Accès refusé');
    }
    await this.prisma.employeeException.delete({ where: { id: exceptionId } });
    return { success: true };
  }
}
