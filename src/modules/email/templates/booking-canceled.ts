// Email template: Booking canceled.
// Sent to the client (requester) when a booking is canceled.

import { wrapInLayout, ctaButton, detailRow, detailsTable } from './base-layout';
import { formatDate, formatTime } from './helpers';

export interface BookingCanceledData {
  clientName: string;
  businessName: string;
  serviceName: string;
  scheduledAt: Date | null;
  canceledBy: string;
  frontendUrl: string;
}

export function buildBookingCanceledEmail(data: BookingCanceledData): {
  subject: string;
  html: string;
} {
  const rows = [
    detailRow('Salon', data.businessName),
    detailRow('Prestation', data.serviceName),
    ...(data.scheduledAt
      ? [
          detailRow('Date', formatDate(data.scheduledAt)),
          detailRow('Heure', formatTime(data.scheduledAt)),
        ]
      : []),
    detailRow('Annulé par', data.canceledBy),
  ].join('');

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D3436;">
      Rendez-vous annulé
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#636E72;line-height:1.5;">
      Bonjour ${data.clientName},<br>
      Votre rendez-vous chez <strong>${data.businessName}</strong> a été annulé.
    </p>

    ${detailsTable(rows)}

    <p style="margin:20px 0 0;font-size:14px;color:#636E72;line-height:1.5;">
      Vous pouvez reprendre rendez-vous à tout moment.
    </p>

    ${ctaButton('Reprendre rendez-vous', `${data.frontendUrl}/search`)}
  `;

  return {
    subject: `Rendez-vous annulé — ${data.businessName}`,
    html: wrapInLayout(content, `Votre rendez-vous chez ${data.businessName} a été annulé.`),
  };
}
