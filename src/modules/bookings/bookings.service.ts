import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingStatus, ServiceKind } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBookingDto) {
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

    return this.prisma.booking.create({
      data: {
        serviceId: dto.serviceId,
        requesterId,
        providerId,
        agreedPriceCents: dto.agreedPriceCents,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
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
  }

  async accept(userId: string, bookingId: string) {
    const booking = await this.findOneOrFail(bookingId);
    this.assertUserInBooking(userId, booking);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Booking must be PENDING to accept');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ACCEPTED },
    });
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

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELED },
    });
  }

  async findByUser(userId: string, role?: 'requester' | 'provider') {
    const where: any = {};

    if (role === 'requester') {
      where.requesterId = userId;
    } else if (role === 'provider') {
      where.providerId = userId;
    } else {
      where.OR = [{ requesterId: userId }, { providerId: userId }];
    }

    return this.prisma.booking.findMany({
      where,
      include: {
        service: {
          select: { id: true, title: true, kind: true },
        },
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
  }

  async findOne(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
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
