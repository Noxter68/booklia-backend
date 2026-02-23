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

    // Only the requester (client) can review the provider (business)
    const isRequester = booking.requesterId === userId;

    if (!isRequester) {
      throw new ForbiddenException('Only the client can review the business');
    }

    // Check if review already exists
    const existingReview = booking.reviews.find((r) => r.type === ReviewType.REVIEW_PROVIDER);
    if (existingReview) {
      throw new BadRequestException('Review already exists for this booking');
    }

    // Create the review
    const review = await this.prisma.review.create({
      data: {
        bookingId: dto.bookingId,
        authorId: userId,
        targetUserId: booking.providerId,
        type: ReviewType.REVIEW_PROVIDER,
        score: dto.score,
        comment: dto.comment,
      },
    });

    return review;
  }

  async findByUser(userId: string) {
    return this.prisma.review.findMany({
      where: { targetUserId: userId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        booking: {
          select: {
            businessService: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByBusiness(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return this.prisma.review.findMany({
      where: {
        targetUserId: business.ownerId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
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
