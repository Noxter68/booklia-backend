import { Controller, Get, Post, Patch, Body, Param, UseGuards, Header } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { User } from '@prisma/client';

const PUBLIC_REVIEWS_CACHE = 'public, max-age=120, stale-while-revalidate=600';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(@CurrentUser() user: User, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.id, dto);
  }

  @Get('user/:userId')
  @Header('Cache-Control', PUBLIC_REVIEWS_CACHE)
  async findByUser(@Param('userId') userId: string) {
    return this.reviewsService.findByUser(userId);
  }

  @Get('business/:businessId')
  @Header('Cache-Control', PUBLIC_REVIEWS_CACHE)
  async findByBusiness(@Param('businessId') businessId: string) {
    return this.reviewsService.findByBusiness(businessId);
  }

  @Patch(':reviewId/reply')
  @UseGuards(AuthGuard)
  async reply(
    @CurrentUser() user: User,
    @Param('reviewId') reviewId: string,
    @Body('reply') reply: string,
  ) {
    return this.reviewsService.replyToReview(user.id, reviewId, reply);
  }
}
