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
import { BookingStatus, ServiceKind } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    private websocketGateway: WebsocketGateway,
  ) {}

  async create(userId: string, dto: CreateBookingDto) {
    // Business booking
    if (dto.businessServiceId && dto.employeeId) {
      return this.createBusinessBooking(userId, dto);
    }

    // P2P booking
    if (!dto.serviceId) {
      throw new BadRequestException('serviceId is required for P2P bookings');
    }

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      include: { createdBy: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (service.createdByUserId === userId) {
      throw new BadRequestException('You cannot book your own service');
    }

    // Determine requester and provider based on service kind
    let requesterId: string;
    let providerId: string;

    if (service.kind === ServiceKind.OFFER) {
      // User is requesting the offered service
      requesterId = userId;
      providerId = service.createdByUserId;
    } else {
      // User is offering to fulfill the request
      requesterId = service.createdByUserId;
      providerId = userId;
    }

    const booking = await this.prisma.booking.create({
      data: {
        serviceId: dto.serviceId,
        requesterId,
        providerId,
        agreedPriceCents: dto.agreedPriceCents,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        notes: dto.notes,
        requesterPhone: dto.requesterPhone,
        requesterAddress: dto.requesterAddress,
      },
      include: {
        service: true,
        requester: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        provider: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    // Send notification to provider
    const requesterName = booking.requester.profile?.displayName || 'Quelqu\'un';
    await this.notificationsService.notifyNewBooking(
      providerId,
      requesterName,
      service.title,
      booking.id,
    );

    return booking;
  }

  private async createBusinessBooking(userId: string, dto: CreateBookingDto) {
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

    // Calculate scheduledEndAt based on service duration
    let scheduledAt: Date | undefined;
    let scheduledEndAt: Date | undefined;
    if (dto.scheduledAt) {
      scheduledAt = new Date(dto.scheduledAt);
      scheduledEndAt = new Date(scheduledAt.getTime() + businessService.durationMinutes * 60000);
    }

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
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        provider: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    // Send notification to business owner (provider)
    const requesterName = booking.requester.profile?.displayName || 'Quelqu\'un';
    await this.notificationsService.notifyNewBooking(
      businessService.business.ownerId,
      requesterName,
      businessService.name,
      booking.id,
    );

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

    // Send notification to requester
    const providerName = booking.provider.profile?.displayName || 'Le prestataire';
    const serviceTitle = booking.service?.title || booking.businessService?.name || 'un service';
    await this.notificationsService.notifyBookingAccepted(
      booking.requesterId,
      providerName,
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

  async start(userId: string, bookingId: string) {
    const booking = await this.findOneOrFail(bookingId);
    this.assertUserInBooking(userId, booking);

    if (booking.status !== BookingStatus.ACCEPTED) {
      throw new BadRequestException('Booking must be ACCEPTED to start');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.IN_PROGRESS },
    });
  }

  async complete(userId: string, bookingId: string) {
    const booking = await this.findOneOrFail(bookingId);
    this.assertUserInBooking(userId, booking);

    if (booking.status !== BookingStatus.IN_PROGRESS) {
      throw new BadRequestException('Booking must be IN_PROGRESS to complete');
    }

    // Award XP for completing a booking
    await this.prisma.userReputation.upsert({
      where: { userId: booking.requesterId },
      update: { xp: { increment: 5 } },
      create: { userId: booking.requesterId, xp: 5 },
    });

    await this.prisma.userReputation.upsert({
      where: { userId: booking.providerId },
      update: { xp: { increment: 5 } },
      create: { userId: booking.providerId, xp: 5 },
    });

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
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

    // Check if this is a late cancellation (< 24h before scheduled time)
    // Only applies if booking was ACCEPTED and has a scheduled time
    let isLateCancellation = false;
    if (
      booking.status === BookingStatus.ACCEPTED &&
      booking.scheduledAt
    ) {
      const now = new Date();
      const scheduledTime = new Date(booking.scheduledAt);
      const hoursUntilScheduled = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilScheduled < 24 && hoursUntilScheduled > 0) {
        isLateCancellation = true;

        // Apply penalty to the user canceling
        await this.prisma.userReputation.upsert({
          where: { userId },
          update: { lateCancellationCount: { increment: 1 } },
          create: { userId, lateCancellationCount: 1 },
        });
      }
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELED },
    });

    // Determine who is canceling and notify the other party
    const isRequester = booking.requesterId === userId;
    const cancellerName = isRequester
      ? booking.requester.profile?.displayName || 'Le demandeur'
      : booking.provider.profile?.displayName || 'Le prestataire';
    const serviceTitle = booking.service?.title || booking.businessService?.name || 'un service';
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

    return { ...updated, isLateCancellation };
  }

  // Allow either party to delete a canceled booking from their view
  async deleteByRequester(userId: string, bookingId: string) {
    const booking = await this.findOneOrFail(bookingId);

    // Either party can delete the booking
    if (booking.requesterId !== userId && booking.providerId !== userId) {
      throw new ForbiddenException('You are not part of this booking');
    }

    // Can only delete if status is CANCELED
    if (booking.status !== BookingStatus.CANCELED) {
      throw new BadRequestException('Only canceled bookings can be deleted');
    }

    return this.prisma.booking.delete({
      where: { id: bookingId },
    });
  }

  async reject(userId: string, bookingId: string, message?: string) {
    const booking = await this.findOneOrFail(bookingId);

    // Only the provider can reject
    if (booking.providerId !== userId) {
      throw new ForbiddenException('Only the provider can reject a booking');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Booking must be PENDING to reject');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELED,
        rejectionMessage: message,
      },
    });

    // Send notification to requester
    const providerName = booking.provider.profile?.displayName || 'Le prestataire';
    const serviceTitle = booking.service?.title || booking.businessService?.name || 'un service';
    await this.notificationsService.notifyBookingRejected(
      booking.requesterId,
      providerName,
      serviceTitle,
      bookingId,
    );

    // Send real-time status update to requester
    this.websocketGateway.sendBookingStatusUpdate(booking.requesterId, {
      ...booking,
      status: BookingStatus.CANCELED,
      rejectionMessage: message,
    });

    return updated;
  }

  async findByUser(userId: string, role?: 'requester' | 'provider', from?: string, to?: string) {
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

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        // P2P booking relations
        service: {
          select: { id: true, title: true, kind: true },
        },
        // Business booking relations
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
        // Common relations
        requester: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        provider: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        reviews: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Hide requesterPhone if booking is not accepted (for provider view)
    return bookings.map((booking) => {
      // Only show phone if user is the provider AND status is ACCEPTED or later
      const isProvider = booking.providerId === userId;
      const isAcceptedOrLater = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status);

      if (isProvider && !isAcceptedOrLater) {
        // Hide contact info for pending bookings
        return {
          ...booking,
          requesterPhone: null,
          requesterAddress: null,
        };
      }

      // For requester view, always show their own contact info
      // For provider view with accepted status, show contact info
      return booking;
    });
  }

  async findOne(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        businessService: {
          include: {
            business: true,
          },
        },
        employee: true,
        requester: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        provider: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
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

  private assertUserInBooking(userId: string, booking: any) {
    if (booking.requesterId !== userId && booking.providerId !== userId) {
      throw new ForbiddenException('You are not part of this booking');
    }
  }
}
