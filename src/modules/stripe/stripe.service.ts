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

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer;
  }

  async createSubscriptionCheckout(userId: string, priceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.createCustomer(userId, user.email);
      customerId = customer.id;
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.configService.get('FRONTEND_URL')}/dashboard?subscription=success`,
      cancel_url: `${this.configService.get('FRONTEND_URL')}/pricing?subscription=canceled`,
    });

    return { url: session.url };
  }

  async createBoostCheckout(userId: string, serviceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.createCustomer(userId, user.email);
      customerId = customer.id;
    }

    const boostPriceId = this.configService.get('STRIPE_BOOST_PRICE_ID');

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: boostPriceId, quantity: 1 }],
      metadata: { serviceId },
      success_url: `${this.configService.get('FRONTEND_URL')}/dashboard?boost=success`,
      cancel_url: `${this.configService.get('FRONTEND_URL')}/service/${serviceId}?boost=canceled`,
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

      await this.prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: SubscriptionStatus.PRO,
        },
      });
    } else if (session.mode === 'payment' && session.metadata?.serviceId) {
      // Boost payment
      const boostedUntil = new Date();
      boostedUntil.setDate(boostedUntil.getDate() + 7);

      await this.prisma.service.update({
        where: { id: session.metadata.serviceId },
        data: { boostedUntil },
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

    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { subscriptionStatus: status },
    });
  }

  async createBillingPortal(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${this.configService.get('FRONTEND_URL')}/dashboard`,
    });

    return { url: session.url };
  }
}
