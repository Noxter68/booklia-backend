// Scheduled email tasks (cron jobs).
// Handles sending 24h booking reminders to clients.

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';
import { EmailService } from './email.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class EmailSchedulerService {
  private readonly logger = new Logger(EmailSchedulerService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private config: ConfigService,
    private cacheService: CacheService,
  ) {
    this.frontendUrl =
      config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Runs every 15 minutes to send reminder emails for bookings
   * scheduled approximately 24 hours from now.
   *
   * Window: 23h45 to 24h15 from current time.
   * The `reminderSentAt` field prevents duplicate sends.
   */
  @Cron('0 */15 * * * *')
  async sendUpcomingBookingReminders(): Promise<void> {
    // Leader election: only one replica runs this tick.
    // Lock TTL (10 min) is shorter than the cron interval (15 min) so it
    // always clears before the next fire, but long enough to cover execution.
    const gotLock = await this.cacheService.acquireLock(
      'cron:booking-reminders',
      600,
    );
    if (!gotLock) {
      this.logger.debug('Booking reminders skipped (another replica holds the lock)');
      return;
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60_000 + 45 * 60_000);
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60_000 + 15 * 60_000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.ACCEPTED,
        scheduledAt: {
          gte: windowStart,
          lte: windowEnd,
        },
        reminderSentAt: null,
      },
      include: {
        requester: { select: { name: true, email: true } },
        employee: { select: { firstName: true, lastName: true } },
        businessService: {
          include: {
            business: {
              select: {
                name: true,
                address: true,
                city: true,
                postalCode: true,
              },
            },
          },
        },
      },
    });

    if (bookings.length === 0) return;

    this.logger.log(`Sending ${bookings.length} booking reminder(s)`);

    for (const booking of bookings) {
      const clientEmail = booking.requester.email;
      if (!clientEmail || !booking.businessService) continue;

      await this.emailService.sendBookingReminder(clientEmail, {
        clientName: booking.requester.name || 'Client',
        businessName: booking.businessService.business.name,
        serviceName: booking.businessService.name,
        employeeName: `${booking.employee.firstName} ${booking.employee.lastName}`,
        scheduledAt: booking.scheduledAt!,
        durationMinutes: booking.businessService.durationMinutes,
        priceCents: booking.agreedPriceCents || booking.businessService.priceCents,
        address: booking.businessService.business.address || '',
        city: booking.businessService.business.city || '',
        postalCode: booking.businessService.business.postalCode || '',
        frontendUrl: this.frontendUrl,
      });

      // Mark as sent to prevent duplicate reminders
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: now },
      });
    }
  }
}
