import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { CreateReferralDto } from './dto/create-referral.dto';

const MAX_REFERRALS_PER_24H = 4;

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  /** Resolve the current user's business id (owner). */
  private async getOwnedBusinessId(userId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }
    return business.id;
  }

  /**
   * Create a referral proposed by a business.
   * Rate-limited per business: MAX_REFERRALS_PER_24H within a rolling 24h
   * window via Redis counter (fail-open if Redis is unavailable).
   */
  async create(userId: string, dto: CreateReferralDto) {
    const businessId = await this.getOwnedBusinessId(userId);

    const rateKey = `referral-create:${businessId}`;
    const count = (await this.cacheService.get<number>(rateKey)) ?? 0;
    if (count >= MAX_REFERRALS_PER_24H) {
      throw new HttpException(
        'Limite de parrainages atteinte pour aujourd\'hui (4/jour). Réessayez demain.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const referral = await this.prisma.referral.create({
      data: {
        businessId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        instagram: dto.instagram,
        phone: dto.phone,
      },
    });

    await this.cacheService.set(rateKey, count + 1, 24 * 60 * 60);

    return referral;
  }

  /** List referrals submitted by the current business + progression info. */
  async listMine(userId: string) {
    const businessId = await this.getOwnedBusinessId(userId);

    const [referrals, business] = await Promise.all([
      this.prisma.referral.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.business.findUnique({
        where: { id: businessId },
        select: { freeMonthsEarned: true },
      }),
    ]);

    // Progression toward the next free month: count validated referrals
    // not yet rewarded. When that count reaches 2, admin validation on the
    // second one credits a month and resets the pair.
    const validatedNotRewarded = referrals.filter(
      (r) => r.status === 'VALIDATED' && r.rewardGrantedAt === null,
    ).length;

    return {
      data: referrals,
      freeMonthsEarned: business?.freeMonthsEarned ?? 0,
      validatedTowardNext: validatedNotRewarded,
      nextRewardThreshold: 2,
    };
  }

  // ============================================
  // ADMIN
  // ============================================

  /**
   * Admin sidebar badge: count PENDING referrals, optionally only those
   * created after `since` (ISO date string from the admin's last visit).
   */
  async adminPendingCount(since?: string) {
    const where: { status: 'PENDING'; createdAt?: { gt: Date } } = {
      status: 'PENDING',
    };
    if (since) {
      const date = new Date(since);
      if (!isNaN(date.getTime())) {
        where.createdAt = { gt: date };
      }
    }
    const count = await this.prisma.referral.count({ where });
    return { count };
  }

  /**
   * Admin: list referrals grouped by business with counters.
   * One row per business that has at least one referral.
   */
  async adminListGroupedByBusiness() {
    const grouped = await this.prisma.referral.groupBy({
      by: ['businessId'],
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
    });

    if (grouped.length === 0) {
      return [];
    }

    const businessIds = grouped.map((g) => g.businessId);
    const [businesses, statusCounts] = await Promise.all([
      this.prisma.business.findMany({
        where: { id: { in: businessIds } },
        select: {
          id: true,
          name: true,
          slug: true,
          freeMonthsEarned: true,
          owner: { select: { name: true, email: true } },
        },
      }),
      this.prisma.referral.groupBy({
        by: ['businessId', 'status'],
        where: { businessId: { in: businessIds } },
        _count: { _all: true },
      }),
    ]);

    const statusMap = new Map<string, { pending: number; validated: number; rejected: number }>();
    for (const id of businessIds) {
      statusMap.set(id, { pending: 0, validated: 0, rejected: 0 });
    }
    for (const row of statusCounts) {
      const bucket = statusMap.get(row.businessId)!;
      if (row.status === 'PENDING') bucket.pending = row._count._all;
      else if (row.status === 'VALIDATED') bucket.validated = row._count._all;
      else if (row.status === 'REJECTED') bucket.rejected = row._count._all;
    }

    const businessMap = new Map(businesses.map((b) => [b.id, b]));

    return grouped.map((g) => {
      const business = businessMap.get(g.businessId);
      const counts = statusMap.get(g.businessId)!;
      return {
        businessId: g.businessId,
        businessName: business?.name ?? 'Business inconnu',
        businessSlug: business?.slug ?? null,
        ownerName: business?.owner?.name ?? null,
        ownerEmail: business?.owner?.email ?? null,
        freeMonthsEarned: business?.freeMonthsEarned ?? 0,
        totalReferrals: g._count._all,
        pendingCount: counts.pending,
        validatedCount: counts.validated,
        rejectedCount: counts.rejected,
        lastSubmittedAt: g._max.createdAt,
      };
    });
  }

  /** Admin: list all referrals of a given business, newest first. */
  async adminListForBusiness(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        slug: true,
        freeMonthsEarned: true,
        owner: { select: { name: true, email: true } },
      },
    });
    if (!business) {
      throw new NotFoundException('Business non trouvé');
    }

    const referrals = await this.prisma.referral.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });

    return { business, referrals };
  }

  /**
   * Admin: mark a referral as validated. If this completes a pair of
   * validated-not-yet-rewarded referrals on the same business, credit one
   * free month and stamp both with rewardGrantedAt.
   */
  async adminValidate(referralId: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
    });
    if (!referral) {
      throw new NotFoundException('Parrainage non trouvé');
    }
    if (referral.status === 'VALIDATED') {
      throw new BadRequestException('Parrainage déjà validé');
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.referral.update({
        where: { id: referralId },
        data: { status: 'VALIDATED', validatedAt: now, rejectedAt: null },
      });

      // Look for another already-validated referral on the same business
      // that hasn't been rewarded yet. If we find one, this completes a pair.
      const pendingReward = await tx.referral.findFirst({
        where: {
          businessId: updated.businessId,
          status: 'VALIDATED',
          rewardGrantedAt: null,
          id: { not: updated.id },
        },
        orderBy: { validatedAt: 'asc' },
      });

      let rewarded = false;
      if (pendingReward) {
        await tx.referral.updateMany({
          where: { id: { in: [updated.id, pendingReward.id] } },
          data: { rewardGrantedAt: now },
        });
        await tx.business.update({
          where: { id: updated.businessId },
          data: { freeMonthsEarned: { increment: 1 } },
        });
        rewarded = true;
      }

      return { updated, rewarded, businessId: updated.businessId };
    });

    // Notify the business owner so the dashboard refreshes the progression.
    const owner = await this.prisma.business.findUnique({
      where: { id: result.businessId },
      select: { ownerId: true },
    });
    if (owner) {
      this.websocketGateway.server
        ?.to(`user:${owner.ownerId}`)
        .emit('referral:validated', {
          referralId: result.updated.id,
          rewarded: result.rewarded,
        });
    }

    return result.updated;
  }

  /** Admin: mark a referral as rejected. Does not affect rewards. */
  async adminReject(referralId: string, reason?: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
    });
    if (!referral) {
      throw new NotFoundException('Parrainage non trouvé');
    }
    if (referral.status === 'REJECTED') {
      throw new BadRequestException('Parrainage déjà rejeté');
    }
    if (referral.rewardGrantedAt) {
      throw new BadRequestException(
        'Impossible de rejeter un parrainage déjà récompensé',
      );
    }

    return this.prisma.referral.update({
      where: { id: referralId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        validatedAt: null,
        notes: reason?.trim() || referral.notes,
      },
    });
  }

  /** Admin: free-form notes on a referral (for follow-up context). */
  async adminUpdateNotes(referralId: string, notes: string | null) {
    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
    });
    if (!referral) {
      throw new NotFoundException('Parrainage non trouvé');
    }
    return this.prisma.referral.update({
      where: { id: referralId },
      data: { notes: notes?.trim() || null },
    });
  }
}
