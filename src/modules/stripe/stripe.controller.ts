import {
  Controller,
  Post,
  Body,
  Headers,
  UseGuards,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { Request } from 'express';

@Controller('stripe')
export class StripeController {
  constructor(private stripeService: StripeService) {}

  @Post('subscribe')
  @UseGuards(AuthGuard)
  async createSubscription(
    @CurrentUser() user: User,
    @Body('priceId') priceId: string,
  ) {
    return this.stripeService.createSubscriptionCheckout(user.id, priceId);
  }

  @Post('portal')
  @UseGuards(AuthGuard)
  async createPortal(@CurrentUser() user: User) {
    return this.stripeService.createBillingPortal(user.id);
  }

  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.stripeService.handleWebhook(req.rawBody!, signature);
  }
}
