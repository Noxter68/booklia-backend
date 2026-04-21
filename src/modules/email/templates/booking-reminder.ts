// Email template: 24h booking reminder.
// Sent to the client (requester) 24 hours before their appointment.

import { wrapInLayout, ctaButton, detailRow, detailsTable } from './base-layout';
import { formatDate, formatTime, formatPrice } from './helpers';
import { getEmailTranslations } from './i18n';

export interface BookingReminderData {
  clientName: string;
  businessName: string;
  serviceName: string;
  employeeName: string;
  scheduledAt: Date;
  durationMinutes: number;
  priceCents: number;
  address: string;
  city: string;
  postalCode: string;
  frontendUrl: string;
  locale?: string;
}

export function buildBookingReminderEmail(data: BookingReminderData): {
  subject: string;
  html: string;
} {
  const locale = data.locale || 'fr';
  const t = getEmailTranslations(locale);

  const fullAddress = [data.address, data.postalCode, data.city]
    .filter(Boolean)
    .join(', ');

  const rows = [
    detailRow(t.salon, data.businessName),
    detailRow(t.service, data.serviceName),
    detailRow(t.with, data.employeeName),
    detailRow(t.date, formatDate(data.scheduledAt, locale)),
    detailRow(t.time, formatTime(data.scheduledAt, locale)),
    detailRow(t.duration, `${data.durationMinutes} ${t.min}`),
    detailRow(t.price, formatPrice(data.priceCents, locale)),
    detailRow(t.address, fullAddress),
  ].join('');

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D3436;">
      ${t.bookingReminderTitle}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#636E72;line-height:1.5;">
      ${t.bookingReminderBody(data.clientName, data.businessName)}
    </p>

    ${detailsTable(rows)}

    ${ctaButton(t.bookingReminderCta, `${data.frontendUrl}/mes-reservations`)}

    <p style="margin:24px 0 0;font-size:13px;color:#636E72;line-height:1.5;text-align:center;">
      ${t.bookingReminderFooter}
    </p>
  `;

  return {
    subject: t.bookingReminderSubject(data.businessName),
    html: wrapInLayout(content, t.bookingReminderPreview(data.businessName), locale),
  };
}
