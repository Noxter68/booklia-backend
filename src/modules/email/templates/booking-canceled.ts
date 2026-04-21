// Email template: Booking canceled.
// Sent to the client (requester) when a booking is canceled.

import { wrapInLayout, ctaButton, detailRow, detailsTable } from './base-layout';
import { formatDate, formatTime } from './helpers';
import { getEmailTranslations } from './i18n';

export interface BookingCanceledData {
  clientName: string;
  businessName: string;
  serviceName: string;
  scheduledAt: Date | null;
  canceledBy: string;
  frontendUrl: string;
  locale?: string;
}

export function buildBookingCanceledEmail(data: BookingCanceledData): {
  subject: string;
  html: string;
} {
  const locale = data.locale || 'fr';
  const t = getEmailTranslations(locale);

  const rows = [
    detailRow(t.salon, data.businessName),
    detailRow(t.service, data.serviceName),
    ...(data.scheduledAt
      ? [
          detailRow(t.date, formatDate(data.scheduledAt, locale)),
          detailRow(t.time, formatTime(data.scheduledAt, locale)),
        ]
      : []),
    detailRow(t.canceledBy, data.canceledBy),
  ].join('');

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D3436;">
      ${t.bookingCanceledTitle}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#636E72;line-height:1.5;">
      ${t.bookingCanceledBody(data.clientName, data.businessName)}
    </p>

    ${detailsTable(rows)}

    <p style="margin:20px 0 0;font-size:14px;color:#636E72;line-height:1.5;">
      ${t.bookingCanceledFooter}
    </p>

    ${ctaButton(t.bookingCanceledCta, `${data.frontendUrl}/search`)}
  `;

  return {
    subject: t.bookingCanceledSubject(data.businessName),
    html: wrapInLayout(content, t.bookingCanceledPreview(data.businessName), locale),
  };
}
