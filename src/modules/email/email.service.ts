// Core email service wrapping the Resend SDK.
// All outbound emails go through this service.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  BookingAcceptedData,
  buildBookingAcceptedEmail,
} from './templates/booking-accepted';
import {
  BookingCanceledData,
  buildBookingCanceledEmail,
} from './templates/booking-canceled';
import {
  BookingReminderData,
  buildBookingReminderEmail,
} from './templates/booking-reminder';
import {
  EmailVerificationData,
  buildEmailVerificationEmail,
} from './templates/email-verification';
import {
  AdminInvitationData,
  buildAdminInvitationEmail,
} from './templates/admin-invitation';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor(private config: ConfigService) {
    this.resend = new Resend(config.get<string>('RESEND_API_KEY'));
    this.fromEmail =
      config.get<string>('RESEND_FROM_EMAIL') || 'Sidely <noreply@sidely.fr>';
  }

  /**
   * Sends an email via Resend. Logs errors but never throws,
   * so email failures don't break the main application flow.
   */
  private async send(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      if (error) {
        this.logger.error(
          `Failed to send email to ${to}: ${error.message}`,
          error,
        );
        return;
      }

      this.logger.log(`Email sent to ${to}: "${subject}"`);
    } catch (err) {
      this.logger.error(`Unexpected error sending email to ${to}`, err);
    }
  }

  /** Sends a booking confirmation email to the client. */
  async sendBookingAccepted(
    to: string,
    data: BookingAcceptedData,
  ): Promise<void> {
    const { subject, html } = buildBookingAcceptedEmail(data);
    await this.send(to, subject, html);
  }

  /** Sends a booking cancellation email to the client. */
  async sendBookingCanceled(
    to: string,
    data: BookingCanceledData,
  ): Promise<void> {
    const { subject, html } = buildBookingCanceledEmail(data);
    await this.send(to, subject, html);
  }

  /** Sends a 24h reminder email to the client. */
  async sendBookingReminder(
    to: string,
    data: BookingReminderData,
  ): Promise<void> {
    const { subject, html } = buildBookingReminderEmail(data);
    await this.send(to, subject, html);
  }

  /** Sends an email verification link. */
  async sendEmailVerification(
    to: string,
    data: EmailVerificationData,
  ): Promise<void> {
    const { subject, html } = buildEmailVerificationEmail(data);
    await this.send(to, subject, html);
  }

  /** Sends an admin invitation to verify identity. */
  async sendAdminInvitation(
    to: string,
    data: AdminInvitationData,
  ): Promise<void> {
    const { subject, html } = buildAdminInvitationEmail(data);
    await this.send(to, subject, html);
  }
}
