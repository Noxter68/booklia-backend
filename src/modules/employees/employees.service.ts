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
  CreateEmployeeExceptionDto,
  ListEmployeeExceptionsDto,
} from './dto/employee.dto';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  private async invalidateBusinessEmployees(business: {
    id: string;
    slug: string;
    ownerId: string;
  }) {
    // The full business payload (findBySlug, findByOwner, findByOwnerPublic)
    // embeds the employees list, so editing staff must bust those caches too.
    await Promise.all([
      this.cacheService.del(CacheService.employeesBusinessKey(business.id)),
      this.cacheService.del(CacheService.businessKey(business.slug)),
      this.cacheService.del(CacheService.businessMineKey(business.ownerId)),
      this.cacheService.del(CacheService.businessOwnerPublicKey(business.ownerId)),
    ]);
  }

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

    await this.invalidateBusinessEmployees(business);
    return employee;
  }

  async findByBusiness(businessId: string) {
    const cacheKey = CacheService.employeesBusinessKey(businessId);
    type Result = Awaited<ReturnType<typeof this.findByBusinessUncached>>;
    const cached = await this.cacheService.get<Result>(cacheKey);
    if (cached) return cached;

    const result = await this.findByBusinessUncached(businessId);
    await this.cacheService.set(cacheKey, result, CacheService.TTL.EMPLOYEES_BUSINESS);
    return result;
  }

  private findByBusinessUncached(businessId: string) {
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

    await this.invalidateBusinessEmployees(business);
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

    await this.invalidateBusinessEmployees(business);
    return { success: true };
  }

  /**
   * Returns slots for a date range in a single response. Backed by 5 DB
   * queries total instead of 5 per day:
   *   1× employee + weekly availabilities
   *   1× service + pricing tiers
   *   1× exceptions findMany over the range
   *   1× bookings findMany over the range
   *   1× last COMPLETED booking (parallel, for loyalty)
   */
  async getAvailableSlotsRange(
    employeeId: string,
    businessServiceId: string,
    dateFrom: string,
    dateTo: string,
    requesterId: string | null = null,
  ) {
    const fromParts = dateFrom.split('-').map(Number);
    const toParts = dateTo.split('-').map(Number);
    const startOfRange = new Date(fromParts[0], fromParts[1] - 1, fromParts[2], 0, 0, 0, 0);
    const endOfRange = new Date(toParts[0], toParts[1] - 1, toParts[2], 23, 59, 59, 999);
    const startUtc = new Date(Date.UTC(fromParts[0], fromParts[1] - 1, fromParts[2]));
    const endUtc = new Date(Date.UTC(toParts[0], toParts[1] - 1, toParts[2]));

    if (endOfRange.getTime() < startOfRange.getTime()) {
      throw new BadRequestException('dateTo must be on or after dateFrom');
    }

    const [employee, service, exceptions, bookingsOnRange, lastCompletedBooking] =
      await Promise.all([
        this.prisma.employee.findUnique({
          where: { id: employeeId },
          include: { availabilities: true },
        }),
        this.prisma.businessService.findUnique({
          where: { id: businessServiceId },
          include: { pricingTiers: { orderBy: { thresholdWeeks: 'asc' } } },
        }),
        this.prisma.employeeException.findMany({
          where: {
            employeeId,
            date: { gte: startUtc, lte: endUtc },
          },
          include: { slots: true },
        }),
        this.prisma.booking.findMany({
          where: {
            employeeId,
            scheduledAt: { gte: startOfRange, lte: endOfRange },
            status: { in: ['PENDING', 'ACCEPTED'] },
          },
          include: { businessService: { select: { durationMinutes: true } } },
        }),
        requesterId
          ? this.prisma.booking.findFirst({
              where: {
                requesterId,
                businessServiceId,
                status: 'COMPLETED',
              },
              orderBy: { scheduledAt: 'desc' },
              select: { scheduledAt: true },
            })
          : Promise.resolve(null),
      ]);

    if (!employee) throw new NotFoundException('Employé non trouvé');
    if (!service) throw new NotFoundException('Service non trouvé');

    // Index exceptions by their UTC date midnight (matches @db.Date semantics).
    const exceptionByKey = new Map<string, (typeof exceptions)[number]>();
    for (const exc of exceptions) {
      exceptionByKey.set(exc.date.toISOString().slice(0, 10), exc);
    }

    const slotDuration = service.durationMinutes;
    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    const now = new Date();

    // Iterate one day at a time, in local time.
    const days: { date: string; slots: { time: string; available: boolean }[] }[] = [];
    const cursor = new Date(startOfRange);
    while (cursor.getTime() <= endOfRange.getTime()) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth() + 1;
      const day = cursor.getDate();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const exception = exceptionByKey.get(dateStr) ?? null;

      const dayResult = (() => {
        if (exception?.isClosed) return [];

        type Range = { startTime: string; endTime: string };
        const ranges: Range[] =
          exception && exception.slots.length > 0
            ? exception.slots.map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
            : employee.availabilities
                .filter((a) => a.dayOfWeek === cursor.getDay())
                .map((a) => ({ startTime: a.startTime, endTime: a.endTime }));

        if (ranges.length === 0) return [];

        const isToday =
          now.getFullYear() === year &&
          now.getMonth() === month - 1 &&
          now.getDate() === day;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        const slotsMap = new Map<string, { time: string; available: boolean }>();
        for (const { startTime, endTime } of ranges) {
          const startMin = toMinutes(startTime);
          const endMin = toMinutes(endTime);
          if (endMin <= startMin) continue;

          for (let cur = startMin; cur + slotDuration <= endMin; cur += 30) {
            const hour = Math.floor(cur / 60);
            const min = cur % 60;
            const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
            const isPast = isToday && cur <= nowMinutes;

            const slotStart = new Date(year, month - 1, day, hour, min, 0, 0);
            const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

            const isBooked = bookingsOnRange.some((b) => {
              if (!b.scheduledAt) return false;
              let bEnd = b.scheduledEndAt;
              if (!bEnd && b.businessService?.durationMinutes) {
                bEnd = new Date(
                  b.scheduledAt.getTime() + b.businessService.durationMinutes * 60000,
                );
              }
              if (!bEnd) return false;
              return slotStart < bEnd && slotEnd > b.scheduledAt;
            });

            slotsMap.set(timeStr, { time: timeStr, available: !isBooked && !isPast });
          }
        }

        return Array.from(slotsMap.values()).sort((a, b) => a.time.localeCompare(b.time));
      })();

      days.push({ date: dateStr, slots: dayResult });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      days,
      loyalty: {
        lastCompletedAt: lastCompletedBooking?.scheduledAt ?? null,
        pricingTiers: service.pricingTiers.map((t) => ({
          thresholdWeeks: t.thresholdWeeks,
          surchargeCents: t.surchargeCents,
        })),
      },
    };
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
