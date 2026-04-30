// Email template: Booking accepted by the salon.
// Sent to the client (requester) when a provider accepts their booking.

import { wrapInLayout, ctaButton, detailRow, detailsTable } from './base-layout';
import { formatDate, formatTime, formatPrice } from './helpers';
import { getEmailTranslations } from './i18n';
import { buildBookingIcs } from './ics';

export interface BookingAcceptedData {
  bookingId: string;
  clientName: string;
  businessName: string;
  serviceName: string;
  employeeName: string;
  scheduledAt: Date;
  durationMinutes: number;
  priceCents: number;
  address: string;
  city: string;
  postalCode?: string;
  frontendUrl: string;
  locale?: string;
}

export function buildBookingAcceptedEmail(data: BookingAcceptedData): {
  subject: string;
  html: string;
  icsAttachment: { filename: string; content: Buffer };
} {
  const locale = data.locale || 'fr';
  const t = getEmailTranslations(locale);

  const rows = [
    detailRow(t.salon, data.businessName),
    detailRow(t.service, data.serviceName),
    detailRow(t.with, data.employeeName),
    detailRow(t.date, formatDate(data.scheduledAt, locale)),
    detailRow(t.time, formatTime(data.scheduledAt, locale)),
    detailRow(t.duration, `${data.durationMinutes} ${t.min}`),
    detailRow(t.price, formatPrice(data.priceCents, locale)),
    detailRow(t.address, `${data.address}, ${data.city}`),
  ].join('');

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D3436;">
      ${t.bookingConfirmedTitle}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#636E72;line-height:1.5;">
      ${t.bookingConfirmedBody(data.clientName, data.businessName)}
    </p>

    ${detailsTable(rows)}

    ${ctaButton(t.bookingConfirmedCta, `${data.frontendUrl}/mes-reservations`)}
  `;

  const ics = buildBookingIcs({
    uid: data.bookingId,
    scheduledAt: data.scheduledAt,
    durationMinutes: data.durationMinutes,
    serviceName: data.serviceName,
    businessName: data.businessName,
    employeeName: data.employeeName,
    address: data.address,
    city: data.city,
    postalCode: data.postalCode,
  });

  return {
    subject: t.bookingConfirmedSubject(data.businessName),
    html: wrapInLayout(content, t.bookingConfirmedPreview(data.businessName), locale),
    icsAttachment: { filename: 'rendez-vous.ics', content: ics },
  };
}
