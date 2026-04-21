import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import Stripe from 'stripe';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2026-01-28.clover',
    });
  }

  async createCustomer(userId: string, email: string) {
    const customer = await this.stripe.customers.create({
      email,
      metadata: { userId },
    });

    // Find business by owner and store Stripe customer ID on the business
    await this.prisma.business.updateMany({
      where: { ownerId: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer;
  }

  async createSubscriptionCheckout(userId: string, priceId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
      include: { owner: true },
    });

    if (!business) {
      throw new BadRequestException('Business not found');
    }

    let customerId = business.stripeCustomerId;
    if (!customerId) {
      const customer = await this.createCustomer(userId, business.owner.email);
      customerId = customer.id;
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.configService.get('FRONTEND_URL')}/business/dashboard?subscription=success`,
      cancel_url: `${this.configService.get('FRONTEND_URL')}/pricing?subscription=canceled`,
    });

    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret || '');
    } catch (err) {
      throw new BadRequestException('Webhook signature verification failed');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
    }

    return { received: true };
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session) {
    if (session.mode === 'subscription') {
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      await this.prisma.business.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: SubscriptionStatus.PRO,
        },
      });
    }
  }

  private async handleSubscriptionChange(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    let status: SubscriptionStatus;
    if (subscription.status === 'active') {
      status = SubscriptionStatus.PRO;
    } else if (subscription.status === 'canceled') {
      status = SubscriptionStatus.CANCELED;
    } else {
      status = SubscriptionStatus.FREE;
    }

    await this.prisma.business.updateMany({
      where: { stripeCustomerId: customerId },
      data: { subscriptionStatus: status },
    });
  }

  async createBillingPortal(userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId: userId },
    });

    if (!business?.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: business.stripeCustomerId,
      return_url: `${this.configService.get('FRONTEND_URL')}/business/dashboard`,
    });

    return { url: session.url };
  }
}
