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
import {
  InvoiceSentData,
  buildInvoiceSentEmail,
} from './templates/invoice-sent';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor(private config: ConfigService) {
    this.resend = new Resend(config.get<string>('RESEND_API_KEY'));
    this.fromEmail =
      config.get<string>('RESEND_FROM_EMAIL') || 'Booklia <noreply@booklia.fr>';
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

  /**
   * Sends an email with a single file attachment. Throws on failure so callers
   * can surface the error to the user (e.g., invoice-send button).
   */
  private async sendWithAttachment(
    to: string,
    subject: string,
    html: string,
    attachment: { filename: string; content: Buffer },
  ): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject,
      html,
      attachments: [
        {
          filename: attachment.filename,
          content: attachment.content,
        },
      ],
    });

    if (error) {
      this.logger.error(
        `Failed to send email with attachment to ${to}: ${error.message}`,
        error,
      );
      throw new Error(error.message || 'Email delivery failed');
    }

    this.logger.log(`Email with attachment sent to ${to}: "${subject}"`);
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

  /**
   * Sends an invoice to the client with the PDF attached. Throws on delivery
   * failure so the caller can report it to the user.
   */
  async sendInvoiceToClient(
    to: string,
    data: InvoiceSentData,
    pdf: { filename: string; content: Buffer },
  ): Promise<void> {
    const { subject, html } = buildInvoiceSentEmail(data);
    await this.sendWithAttachment(to, subject, html, pdf);
  }
}
