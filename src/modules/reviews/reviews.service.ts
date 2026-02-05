import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { BookingStatus, ReviewType } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { reviews: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Can only review completed bookings');
    }

    // Determine who can leave which type of review
    const isRequester = booking.requesterId === userId;
    const isProvider = booking.providerId === userId;

    if (!isRequester && !isProvider) {
      throw new ForbiddenException('You are not part of this booking');
    }

    // Validate review type matches user role
    if (dto.type === ReviewType.REVIEW_PROVIDER && !isRequester) {
      throw new ForbiddenException('Only the requester can review the provider');
    }

    if (dto.type === ReviewType.REVIEW_REQUESTER && !isProvider) {
      throw new ForbiddenException('Only the provider can review the requester');
    }

    // Check if review already exists
    const existingReview = booking.reviews.find((r) => r.type === dto.type);
    if (existingReview) {
      throw new BadRequestException('Review already exists for this booking');
    }

    // Determine target user
    const targetUserId =
      dto.type === ReviewType.REVIEW_PROVIDER
        ? booking.providerId
        : booking.requesterId;

    const review = await this.prisma.review.create({
      data: {
        bookingId: dto.bookingId,
        authorId: userId,
        targetUserId,
        type: dto.type,
        score: dto.score,
        comment: dto.comment,
      },
    });

    // Update reputation
    await this.updateReputation(targetUserId, dto.score);

    // Award XP for leaving a review
    await this.awardXpForReview(userId);

    return review;
  }

  private async updateReputation(userId: string, newScore: number) {
    const reputation = await this.prisma.userReputation.findUnique({
      where: { userId },
    });

    if (reputation) {
      const newCount = reputation.ratingCount + 1;
      const newAvg =
        (reputation.ratingAvg10 * reputation.ratingCount + newScore) / newCount;

      // Calculate trust score (simplified: based on rating and count)
      const trustScore = Math.min(100, newAvg * 8 + Math.log(newCount + 1) * 5);

      await this.prisma.userReputation.update({
        where: { userId },
        data: {
          ratingAvg10: newAvg,
          ratingCount: newCount,
          trustScore,
        },
      });
    } else {
      await this.prisma.userReputation.create({
        data: {
          userId,
          ratingAvg10: newScore,
          ratingCount: 1,
          trustScore: newScore * 8,
        },
      });
    }
  }

  private async awardXpForReview(userId: string) {
    const reputation = await this.prisma.userReputation.upsert({
      where: { userId },
      update: { xp: { increment: 5 } },
      create: { userId, xp: 5 },
    });

    // Check for level up (XP required = 100 * currentLevel)
    const xpForNextLevel = 100 * reputation.level;
    if (reputation.xp >= xpForNextLevel) {
      await this.prisma.userReputation.update({
        where: { userId },
        data: { level: { increment: 1 } },
      });
    }
  }

  async findByUser(userId: string) {
    return this.prisma.review.findMany({
      where: { targetUserId: userId },
      include: {
        author: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        booking: {
          select: {
            service: { select: { title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
