import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { BookingStatus, ReviewType } from '@prisma/client';
import { ReputationService } from '../reputation/reputation.service';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private reputationService: ReputationService,
  ) {}

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

    // Create the review
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

    // Get current reputation for the target user
    const targetReputation = await this.prisma.userReputation.findUnique({
      where: { userId: targetUserId },
    });

    // Update target's reputation (ELO + rating average)
    await this.reputationService.onReviewReceived(
      targetUserId,
      dto.score,
      targetReputation?.ratingAvg5 ?? 0,
      targetReputation?.ratingCount ?? 0,
    );

    // Award ELO to the reviewer for leaving a review
    await this.reputationService.onReviewGiven(userId);

    return review;
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
            businessService: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByBusiness(businessId: string) {
    // Find the business to get the owner ID
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Find all reviews targeting the business owner for business bookings
    return this.prisma.review.findMany({
      where: {
        targetUserId: business.ownerId,
        booking: {
          businessServiceId: { not: null },
        },
      },
      include: {
        author: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        booking: {
          select: {
            businessService: {
              select: { name: true },
            },
            employee: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async replyToReview(userId: string, reviewId: string, reply: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        booking: {
          include: {
            businessService: {
              include: { business: true },
            },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check that the user is the business owner
    if (!review.booking.businessService?.business) {
      throw new BadRequestException('Can only reply to business reviews');
    }

    if (review.booking.businessService.business.ownerId !== userId) {
      throw new ForbiddenException('Only the business owner can reply to reviews');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        reply,
        repliedAt: new Date(),
      },
    });
  }
}
