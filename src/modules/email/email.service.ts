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

// Retry transient Resend failures (rate limits, 5xx, network blips).
// Permanent errors (bad address, 4xx other than 429) bail out immediately.
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 2000]; // delays before attempts 2 and 3

function isTransientError(err: unknown): boolean {
  const e = err as { statusCode?: number; name?: string };
  if (e?.statusCode === 429) return true;
  if (e?.statusCode && e.statusCode >= 500) return true;
  if (e?.name === 'rate_limit_exceeded') return true;
  // Network errors (no statusCode at all) are usually transient too.
  if (!e?.statusCode) return true;
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  private async sendOnce(payload: Parameters<Resend['emails']['send']>[0]) {
    const { error } = await this.resend.emails.send(payload);
    if (error) throw error;
  }

  /**
   * Sends through Resend with retry on transient failures. Returns true on
   * success, false otherwise. Never throws — callers can choose to surface
   * the failure (e.g. mark a reminder as not yet sent so it gets retried by
   * the next cron tick).
   */
  private async sendWithRetry(
    to: string,
    subject: string,
    payload: Parameters<Resend['emails']['send']>[0],
  ): Promise<boolean> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.sendOnce(payload);
        if (attempt > 1) {
          this.logger.log(
            `Email to ${to} sent on attempt ${attempt}: "${subject}"`,
          );
        } else {
          this.logger.log(`Email sent to ${to}: "${subject}"`);
        }
        return true;
      } catch (err) {
        lastError = err;
        if (attempt === MAX_ATTEMPTS || !isTransientError(err)) break;
        await sleep(BACKOFF_MS[attempt - 1] ?? 2000);
      }
    }
    this.logger.error(
      `Failed to send email to ${to} after ${MAX_ATTEMPTS} attempt(s): ${
        (lastError as { message?: string })?.message ?? lastError
      }`,
      lastError,
    );
    return false;
  }

  /** Sends a plain email. Returns success/failure. Never throws. */
  private send(to: string, subject: string, html: string): Promise<boolean> {
    return this.sendWithRetry(to, subject, {
      from: this.fromEmail,
      to,
      subject,
      html,
    });
  }

  /**
   * Sends an email with an attachment. Throws on persistent failure so
   * callers (e.g. the invoice-send button) can report it to the user.
   */
  private async sendWithAttachment(
    to: string,
    subject: string,
    html: string,
    attachment: { filename: string; content: Buffer },
  ): Promise<void> {
    const ok = await this.sendWithRetry(to, subject, {
      from: this.fromEmail,
      to,
      subject,
      html,
      attachments: [
        { filename: attachment.filename, content: attachment.content },
      ],
    });
    if (!ok) throw new Error('Email delivery failed');
  }

  /** Fire-and-forget variant of sendWithAttachment — returns boolean. */
  private async sendWithAttachmentSafe(
    to: string,
    subject: string,
    html: string,
    attachment: { filename: string; content: Buffer },
  ): Promise<boolean> {
    return this.sendWithRetry(to, subject, {
      from: this.fromEmail,
      to,
      subject,
      html,
      attachments: [
        { filename: attachment.filename, content: attachment.content },
      ],
    });
  }

  /** Sends a booking confirmation email to the client, with .ics attached. */
  async sendBookingAccepted(
    to: string,
    data: BookingAcceptedData,
  ): Promise<void> {
    const { subject, html, icsAttachment } = buildBookingAcceptedEmail(data);
    await this.sendWithAttachmentSafe(to, subject, html, icsAttachment);
  }

  /** Sends a booking cancellation email to the client. */
  async sendBookingCanceled(
    to: string,
    data: BookingCanceledData,
  ): Promise<void> {
    const { subject, html } = buildBookingCanceledEmail(data);
    await this.send(to, subject, html);
  }

  /**
   * Sends a 24h reminder email to the client, with .ics attached. Returns
   * true on success, false if Resend ultimately rejected. The cron uses this
   * boolean to decide whether to mark the booking as reminded — never mark a
   * failed send as done, otherwise the next tick won't retry.
   */
  async sendBookingReminder(
    to: string,
    data: BookingReminderData,
  ): Promise<boolean> {
    const { subject, html, icsAttachment } = buildBookingReminderEmail(data);
    return this.sendWithAttachmentSafe(to, subject, html, icsAttachment);
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
