import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  REPUTATION_CONFIG,
  getEloChangeForReviewScore,
} from './reputation.constants';

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Ensure user has a reputation record
   */
  private async ensureReputation(userId: string) {
    return this.prisma.userReputation.upsert({
      where: { userId },
      create: {
        userId,
        elo: REPUTATION_CONFIG.INITIAL_ELO,
      },
      update: {},
    });
  }

  /**
   * Safely adjust ELO score (respects min/max bounds)
   */
  private clampElo(elo: number): number {
    return Math.max(
      REPUTATION_CONFIG.MIN_ELO,
      Math.min(REPUTATION_CONFIG.MAX_ELO, elo),
    );
  }

  // ============================================
  // BOOKING EVENTS
  // ============================================

  /**
   * Called when a booking is completed successfully
   * Both requester and provider gain ELO
   */
  async onBookingCompleted(userId: string): Promise<void> {
    await this.ensureReputation(userId);

    const updated = await this.prisma.userReputation.update({
      where: { userId },
      data: {
        elo: { increment: REPUTATION_CONFIG.ELO_BOOKING_COMPLETED },
        completedBookings: { increment: 1 },
      },
    });

    // Clamp ELO if it exceeds max
    if (updated.elo > REPUTATION_CONFIG.MAX_ELO) {
      await this.prisma.userReputation.update({
        where: { userId },
        data: { elo: REPUTATION_CONFIG.MAX_ELO },
      });
    }

    this.logger.log(
      `User ${userId} gained ${REPUTATION_CONFIG.ELO_BOOKING_COMPLETED} ELO for completed booking`,
    );
  }

  /**
   * Called when a user cancels late (< 24h before scheduled time)
   */
  async onLateCancellation(userId: string): Promise<void> {
    await this.ensureReputation(userId);

    const updated = await this.prisma.userReputation.update({
      where: { userId },
      data: {
        elo: { increment: REPUTATION_CONFIG.ELO_LATE_CANCELLATION_PENALTY },
        lateCancellationCount: { increment: 1 },
      },
    });

    // Clamp ELO if it goes below min
    if (updated.elo < REPUTATION_CONFIG.MIN_ELO) {
      await this.prisma.userReputation.update({
        where: { userId },
        data: { elo: REPUTATION_CONFIG.MIN_ELO },
      });
    }

    this.logger.log(
      `User ${userId} lost ${Math.abs(REPUTATION_CONFIG.ELO_LATE_CANCELLATION_PENALTY)} ELO for late cancellation`,
    );
  }

  /**
   * Called when provider cancels an already accepted booking
   */
  async onProviderCancelsAfterAccept(userId: string): Promise<void> {
    await this.ensureReputation(userId);

    const updated = await this.prisma.userReputation.update({
      where: { userId },
      data: {
        elo: {
          increment: REPUTATION_CONFIG.ELO_PROVIDER_CANCEL_AFTER_ACCEPT_PENALTY,
        },
      },
    });

    // Clamp ELO if it goes below min
    if (updated.elo < REPUTATION_CONFIG.MIN_ELO) {
      await this.prisma.userReputation.update({
        where: { userId },
        data: { elo: REPUTATION_CONFIG.MIN_ELO },
      });
    }

    this.logger.log(
      `User ${userId} lost ${Math.abs(REPUTATION_CONFIG.ELO_PROVIDER_CANCEL_AFTER_ACCEPT_PENALTY)} ELO for canceling after acceptance`,
    );
  }

  // ============================================
  // REVIEW EVENTS
  // ============================================

  /**
   * Called when a user gives a review
   */
  async onReviewGiven(userId: string): Promise<void> {
    await this.ensureReputation(userId);

    const updated = await this.prisma.userReputation.update({
      where: { userId },
      data: {
        elo: { increment: REPUTATION_CONFIG.ELO_REVIEW_GIVEN },
      },
    });

    // Clamp ELO
    if (updated.elo > REPUTATION_CONFIG.MAX_ELO) {
      await this.prisma.userReputation.update({
        where: { userId },
        data: { elo: REPUTATION_CONFIG.MAX_ELO },
      });
    }

    this.logger.log(
      `User ${userId} gained ${REPUTATION_CONFIG.ELO_REVIEW_GIVEN} ELO for giving a review`,
    );
  }

  /**
   * Called when a user receives a review
   * Updates ELO based on score and recalculates average rating
   */
  async onReviewReceived(
    userId: string,
    score: number,
    previousAvg: number,
    previousCount: number,
  ): Promise<void> {
    await this.ensureReputation(userId);

    const eloChange = getEloChangeForReviewScore(score);
    const newCount = previousCount + 1;
    const newAvg = (previousAvg * previousCount + score) / newCount;

    const updated = await this.prisma.userReputation.update({
      where: { userId },
      data: {
        elo: { increment: eloChange },
        ratingAvg5: newAvg,
        ratingCount: newCount,
      },
    });

    // Clamp ELO
    const clampedElo = this.clampElo(updated.elo);
    if (clampedElo !== updated.elo) {
      await this.prisma.userReputation.update({
        where: { userId },
        data: { elo: clampedElo },
      });
    }

    this.logger.log(
      `User ${userId} received review (score: ${score}), ELO change: ${eloChange}, new avg: ${newAvg.toFixed(2)}`,
    );
  }

  // ============================================
  // QUERY METHODS
  // ============================================

  /**
   * Get user's reputation
   */
  async getReputation(userId: string) {
    return this.prisma.userReputation.findUnique({
      where: { userId },
    });
  }

  /**
   * Get user's ELO score (returns initial if no reputation exists)
   */
  async getElo(userId: string): Promise<number> {
    const rep = await this.prisma.userReputation.findUnique({
      where: { userId },
      select: { elo: true },
    });
    return rep?.elo ?? REPUTATION_CONFIG.INITIAL_ELO;
  }
}
