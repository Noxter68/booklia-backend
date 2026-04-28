import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateInviteRequestDto } from './dto/create-invite-request.dto';

const MAX_INVITE_REQUESTS_PER_EMAIL_PER_DAY = 3;

@Injectable()
export class InviteRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Public endpoint: capture a closed-beta lead.
   * Per-email rate limit (3/day) keeps spam at bay without blocking
   * legitimate corrections — the IP-level throttler covers raw flood.
   */
  async create(dto: CreateInviteRequestDto) {
    const rateKey = `invite-request:${dto.email}`;
    const count = (await this.cacheService.get<number>(rateKey)) ?? 0;
    if (count >= MAX_INVITE_REQUESTS_PER_EMAIL_PER_DAY) {
      throw new HttpException(
        'Vous avez deja soumis plusieurs demandes aujourd\'hui. Nous vous recontactons sous 24h.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const created = await this.prisma.inviteRequest.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
      },
    });

    await this.cacheService.set(rateKey, count + 1, 24 * 60 * 60);

    return { id: created.id, success: true };
  }

  // ============================================
  // ADMIN
  // ============================================

  async adminList() {
    return this.prisma.inviteRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Pending count for the admin sidebar badge: number of requests
   * created strictly after `since` (the admin's lastSeenAt) — or all
   * requests when omitted.
   */
  async adminPendingCount(since?: string) {
    const where: { createdAt?: { gt: Date } } = {};
    if (since) {
      const date = new Date(since);
      if (!isNaN(date.getTime())) {
        where.createdAt = { gt: date };
      }
    }
    const count = await this.prisma.inviteRequest.count({ where });
    return { count };
  }

  async adminDelete(id: string) {
    const existing = await this.prisma.inviteRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Demande non trouvee');
    }
    await this.prisma.inviteRequest.delete({ where: { id } });
    return { success: true };
  }

  async adminUpdateNotes(id: string, notes: string | null) {
    const existing = await this.prisma.inviteRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Demande non trouvee');
    }
    return this.prisma.inviteRequest.update({
      where: { id },
      data: { notes: notes?.trim() || null },
    });
  }
}
