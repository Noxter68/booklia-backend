import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  GetAvailableSlotsDto,
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

    // Get employee with availabilities
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

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // Find availability for this day
    const dayAvailability = employee.availabilities.find(
      (a) => a.dayOfWeek === dayOfWeek,
    );

    if (!dayAvailability) {
      return { slots: [] };
    }

    // Get existing bookings for this employee on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        employeeId,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'],
        },
      },
    });

    // Generate available slots
    const slots: { time: string; available: boolean }[] = [];
    const [startHour, startMin] = dayAvailability.startTime
      .split(':')
      .map(Number);
    const [endHour, endMin] = dayAvailability.endTime.split(':').map(Number);

    const slotDuration = service.durationMinutes;
    let currentTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    while (currentTime + slotDuration <= endTime) {
      const hour = Math.floor(currentTime / 60);
      const min = currentTime % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

      // Check if slot conflicts with existing booking
      const slotStart = new Date(date);
      slotStart.setHours(hour, min, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

      const isBooked = existingBookings.some((booking) => {
        if (!booking.scheduledAt || !booking.scheduledEndAt) return false;
        return (
          slotStart < booking.scheduledEndAt && slotEnd > booking.scheduledAt
        );
      });

      slots.push({
        time: timeStr,
        available: !isBooked,
      });

      currentTime += 30; // 30-minute increments
    }

    return { slots };
  }
}
