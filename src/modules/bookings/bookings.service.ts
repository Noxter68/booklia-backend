import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingStatus, CalendarEntryKind } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { ClientsService } from '../clients/clients.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    private websocketGateway: WebsocketGateway,
    @Inject(forwardRef(() => ClientsService))
    private clientsService: ClientsService,
    private cacheService: CacheService,
  ) {}

  async create(userId: string, dto: CreateBookingDto) {
    // Fetch business service
    const businessService = await this.prisma.businessService.findUnique({
      where: { id: dto.businessServiceId },
      include: {
        business: {
          include: { owner: true },
        },
      },
    });

    if (!businessService) {
      throw new NotFoundException('Business service not found');
    }

    // Fetch employee
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.businessId !== businessService.businessId) {
      throw new BadRequestException('Employee does not belong to this business');
    }

    // Check if client is blocked by this business
    const isBlocked = await this.clientsService.isClientBlocked(
      businessService.businessId,
      userId,
    );
    if (isBlocked) {
      throw new ForbiddenException(
        'Vous ne pouvez pas effectuer de réservation auprès de ce professionnel',
      );
    }

    // Calculate scheduledEndAt based on service duration
    let scheduledAt: Date | undefined;
    let scheduledEndAt: Date | undefined;
    if (dto.scheduledAt) {
      scheduledAt = new Date(dto.scheduledAt);
      scheduledEndAt = new Date(scheduledAt.getTime() + businessService.durationMinutes * 60000);
    }

    // Check if business has auto-accept enabled
    const autoAccept = businessService.business.autoAcceptBookings;

    // The requester is the user booking, the provider is the business owner
    const booking = await this.prisma.booking.create({
      data: {
        requesterId: userId,
        providerId: businessService.business.ownerId,
        businessServiceId: dto.businessServiceId,
        employeeId: dto.employeeId,
        agreedPriceCents: businessService.priceCents,
        scheduledAt,
        scheduledEndAt,
        ...(autoAccept && { status: BookingStatus.ACCEPTED }),
      },
      include: {
        businessService: {
          include: {
            business: true,
          },
        },
        employee: true,
        requester: {
          select: {
            id: true,
            name: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (autoAccept) {
      // Auto-accept: notify the client (same flow as manual accept)
      const businessName = businessService.business.name;
      const serviceTitle = businessService.name;
      await this.notificationsService.notifyBookingAccepted(
        userId,
        businessName,
        serviceTitle,
        booking.id,
      );

      // Also notify the business owner about the new auto-accepted booking
      const requesterName = booking.requester.name || 'Quelqu\'un';
      await this.notificationsService.notifyNewBooking(
        businessService.business.ownerId,
        requesterName,
        serviceTitle,
        booking.id,
      );

      // Send real-time status update to requester
      this.websocketGateway.sendBookingStatusUpdate(userId, {
        ...booking,
        status: BookingStatus.ACCEPTED,
      });
    } else {
      // Send notification to business owner (provider)
      const requesterName = booking.requester.name || 'Quelqu\'un';
      await this.notificationsService.notifyNewBooking(
        businessService.business.ownerId,
        requesterName,
        businessService.name,
        booking.id,
      );
    }

    // Auto-create client record (fire-and-forget)
    this.clientsService
      .ensureClient(businessService.businessId, userId)
      .catch(() => {});

    return booking;
  }

  async accept(userId: string, bookingId: string) {
    const booking = await this.findOneOrFail(bookingId);
    this.assertUserInBooking(userId, booking);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Booking must be PENDING to accept');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ACCEPTED },
    });

    // Send notification to requester (use business name instead of owner name)
    const businessName = booking.businessService?.business?.name || booking.provider.name || 'Le prestataire';
    const serviceTitle = booking.businessService?.name || 'un service';
    await this.notificationsService.notifyBookingAccepted(
      booking.requesterId,
      businessName,
      serviceTitle,
      bookingId,
    );

    // Send real-time status update to requester
    this.websocketGateway.sendBookingStatusUpdate(booking.requesterId, {
      ...booking,
      status: BookingStatus.ACCEPTED,
    });

    return updated;
  }

  async complete(userId: string, bookingId: string) {
    const booking = await this.findOneOrFail(bookingId);
    this.assertUserInBooking(userId, booking);

    if (booking.status !== BookingStatus.ACCEPTED) {
      throw new BadRequestException('Booking must be ACCEPTED to complete');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Invalidate client stats cache
    const businessId = booking.businessService?.businessId;
    if (businessId) {
      this.cacheService
        .del(CacheService.clientStatsKey(businessId, booking.requesterId))
        .catch(() => {});
    }

    return updated;
  }

  /**
   * Auto-complete bookings that have passed their scheduled time
   */
  async autoCompleteExpiredBookings() {
    const now = new Date();

    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.ACCEPTED,
        kind: CalendarEntryKind.APPOINTMENT,
        scheduledAt: {
          lt: now,
        },
      },
    });

    const results = [];
    for (const booking of expiredBookings) {
      try {
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.COMPLETED,
            completedAt: now,
          },
        });
        results.push({ id: booking.id, success: true });
      } catch (error) {
        results.push({ id: booking.id, success: false, error: error.message });
      }
    }

    return { processed: results.length, results };
  }

  /**
   * Lazy auto-complete: check and complete expired bookings for a specific user
   */
  private async autoCompleteExpiredForUser(userId: string) {
    const now = new Date();

    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.ACCEPTED,
        kind: CalendarEntryKind.APPOINTMENT,
        scheduledAt: {
          lt: now,
        },
        OR: [{ requesterId: userId }, { providerId: userId }],
      },
    });

    for (const booking of expiredBookings) {
      try {
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.COMPLETED,
            completedAt: now,
          },
        });
      } catch (error) {
        console.error(`Failed to auto-complete booking ${booking.id}:`, error);
      }
    }
  }

  async cancel(userId: string, bookingId: string) {
    const booking = await this.findOneOrFail(bookingId);
    this.assertUserInBooking(userId, booking);

    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELED
    ) {
      throw new BadRequestException('Cannot cancel a completed or already canceled booking');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELED, canceledById: userId },
    });

    // Invalidate client stats cache
    const businessId = booking.businessService?.businessId;
    if (businessId) {
      this.cacheService
        .del(CacheService.clientStatsKey(businessId, booking.requesterId))
        .catch(() => {});
    }

    // Determine who is canceling and notify the other party
    const isRequester = booking.requesterId === userId;
    const cancellerName = isRequester
      ? booking.requester.name || 'Le demandeur'
      : booking.businessService?.business?.name || booking.provider.name || 'Le prestataire';
    const serviceTitle = booking.businessService?.name || 'un service';
    const otherUserId = isRequester ? booking.providerId : booking.requesterId;

    await this.notificationsService.notifyBookingCanceled(
      otherUserId,
      cancellerName,
      serviceTitle,
      bookingId,
    );

    // Send real-time status update to the other party
    this.websocketGateway.sendBookingStatusUpdate(otherUserId, {
      ...booking,
      status: BookingStatus.CANCELED,
    });

    return updated;
  }

  async deleteByRequester(userId: string, bookingId: string) {
    const booking = await this.findOneOrFail(bookingId);

    if (booking.requesterId !== userId && booking.providerId !== userId) {
      throw new ForbiddenException('You are not part of this booking');
    }

    if (booking.status !== BookingStatus.CANCELED) {
      throw new BadRequestException('Only canceled bookings can be deleted');
    }

    return this.prisma.booking.delete({
      where: { id: bookingId },
    });
  }

  async reject(userId: string, bookingId: string, message?: string) {
    const booking = await this.findOneOrFail(bookingId);

    if (booking.providerId !== userId) {
      throw new ForbiddenException('Only the provider can reject a booking');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Booking must be PENDING to reject');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.REJECTED,
        rejectionMessage: message,
      },
    });

    // Send notification to requester (use business name instead of owner name)
    const businessName = booking.businessService?.business?.name || booking.provider.name || 'Le prestataire';
    const serviceTitle = booking.businessService?.name || 'un service';
    await this.notificationsService.notifyBookingRejected(
      booking.requesterId,
      businessName,
      serviceTitle,
      bookingId,
    );

    // Send real-time status update to requester
    this.websocketGateway.sendBookingStatusUpdate(booking.requesterId, {
      ...booking,
      status: BookingStatus.REJECTED,
      rejectionMessage: message,
    });

    return updated;
  }

  async findByUser(userId: string, role?: 'requester' | 'provider', from?: string, to?: string) {
    // First, auto-complete any expired ACCEPTED bookings for this user
    await this.autoCompleteExpiredForUser(userId);

    const where: any = {};

    if (role === 'requester') {
      where.requesterId = userId;
    } else if (role === 'provider') {
      where.providerId = userId;
    } else {
      where.OR = [{ requesterId: userId }, { providerId: userId }];
    }

    // Date filtering on scheduledAt
    if (from || to) {
      where.scheduledAt = {};
      if (from) {
        where.scheduledAt.gte = new Date(from);
      }
      if (to) {
        where.scheduledAt.lte = new Date(to);
      }
    }

    return this.prisma.booking.findMany({
      where,
      include: {
        businessService: {
          include: {
            business: {
              select: { id: true, name: true, slug: true, address: true, city: true },
            },
          },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        requester: {
          select: {
            id: true,
            name: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
        reviews: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        businessService: {
          include: {
            business: true,
          },
        },
        employee: true,
        requester: {
          select: {
            id: true,
            name: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
        reviews: true,
      },
    });
  }

  async findOneOrFail(bookingId: string) {
    const booking = await this.findOne(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  /**
   * Revenue stats: daily aggregation of completed bookings over a date range.
   * Returns { date, revenue, count } for each day with at least one completed booking.
   */
  async getRevenueStats(userId: string, from: Date, to: Date) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        providerId: userId,
        status: BookingStatus.COMPLETED,
        scheduledAt: { gte: from, lte: to },
      },
      select: {
        scheduledAt: true,
        agreedPriceCents: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Group by day
    const dayMap = new Map<string, { revenue: number; count: number }>();
    for (const b of bookings) {
      const day = b.scheduledAt!.toISOString().slice(0, 10);
      const existing = dayMap.get(day) || { revenue: 0, count: 0 };
      existing.revenue += b.agreedPriceCents || 0;
      existing.count += 1;
      dayMap.set(day, existing);
    }

    return Array.from(dayMap.entries()).map(([date, stats]) => ({
      date,
      revenue: stats.revenue,
      count: stats.count,
    }));
  }

  private assertUserInBooking(userId: string, booking: any) {
    if (booking.requesterId !== userId && booking.providerId !== userId) {
      throw new ForbiddenException('You are not part of this booking');
    }
  }
}
