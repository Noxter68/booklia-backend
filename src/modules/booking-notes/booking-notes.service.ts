import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertBookingNoteDto } from './dto/booking-note.dto';

@Injectable()
export class BookingNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async getNote(businessId: string, bookingId: string) {
    const note = await this.prisma.bookingNote.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: {
            businessService: { select: { name: true } },
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!note) {
      throw new NotFoundException('Note non trouvée');
    }

    if (note.businessId !== businessId) {
      throw new ForbiddenException('Accès refusé');
    }

    return note;
  }

  async getClientNotes(
    businessId: string,
    clientId: string,
    limit = 20,
    offset = 0,
  ) {
    const [data, total] = await Promise.all([
      this.prisma.bookingNote.findMany({
        where: { businessId, clientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          booking: {
            include: {
              businessService: { select: { name: true } },
              employee: { select: { firstName: true, lastName: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.bookingNote.count({
        where: { businessId, clientId },
      }),
    ]);

    return { data, total, limit, offset };
  }

  async getClientLastNote(businessId: string, clientId: string) {
    return this.prisma.bookingNote.findFirst({
      where: { businessId, clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          include: {
            businessService: { select: { name: true } },
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async upsert(businessId: string, userId: string, dto: UpsertBookingNoteDto) {
    // Vérifier que le booking existe et appartient au business
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        businessService: { select: { businessId: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Réservation non trouvée');
    }

    if (booking.businessService?.businessId !== businessId) {
      throw new ForbiddenException('Accès refusé');
    }

    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Les notes ne peuvent être ajoutées que sur un RDV terminé',
      );
    }

    return this.prisma.bookingNote.upsert({
      where: { bookingId: dto.bookingId },
      create: {
        businessId,
        clientId: booking.requesterId,
        bookingId: dto.bookingId,
        createdByUserId: userId,
        content: dto.content,
        structured: (dto.structured as Prisma.InputJsonValue) ?? undefined,
        tags: dto.tags ?? [],
      },
      update: {
        content: dto.content,
        structured: (dto.structured as Prisma.InputJsonValue) ?? undefined,
        tags: dto.tags ?? [],
      },
      include: {
        booking: {
          include: {
            businessService: { select: { name: true } },
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async delete(businessId: string, bookingId: string) {
    const note = await this.prisma.bookingNote.findUnique({
      where: { bookingId },
    });

    if (!note) {
      throw new NotFoundException('Note non trouvée');
    }

    if (note.businessId !== businessId) {
      throw new ForbiddenException('Accès refusé');
    }

    await this.prisma.bookingNote.delete({
      where: { bookingId },
    });

    return { success: true };
  }
}
