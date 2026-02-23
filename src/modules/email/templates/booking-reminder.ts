// Email template: 24h booking reminder.
// Sent to the client (requester) 24 hours before their appointment.

import { wrapInLayout, ctaButton, detailRow, detailsTable } from './base-layout';
import { formatDate, formatTime, formatPrice } from './helpers';

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
}

export function buildBookingReminderEmail(data: BookingReminderData): {
  subject: string;
  html: string;
} {
  const fullAddress = [data.address, data.postalCode, data.city]
    .filter(Boolean)
    .join(', ');

  const rows = [
    detailRow('Salon', data.businessName),
    detailRow('Prestation', data.serviceName),
    detailRow('Avec', data.employeeName),
    detailRow('Date', formatDate(data.scheduledAt)),
    detailRow('Heure', formatTime(data.scheduledAt)),
    detailRow('Durée', `${data.durationMinutes} min`),
    detailRow('Prix', formatPrice(data.priceCents)),
    detailRow('Adresse', fullAddress),
  ].join('');

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D3436;">
      Rappel : votre rendez-vous est demain !
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#636E72;line-height:1.5;">
      Bonjour ${data.clientName},<br>
      Nous vous rappelons votre rendez-vous chez <strong>${data.businessName}</strong> prévu demain.
    </p>

    ${detailsTable(rows)}

    ${ctaButton('Voir ma réservation', `${data.frontendUrl}/mes-reservations`)}

    <p style="margin:24px 0 0;font-size:13px;color:#636E72;line-height:1.5;text-align:center;">
      En cas d'empêchement, pensez à annuler votre rendez-vous depuis l'application.
    </p>
  `;

  return {
    subject: `Rappel : rendez-vous demain chez ${data.businessName}`,
    html: wrapInLayout(content, `Rappel : votre rendez-vous chez ${data.businessName} est demain !`),
  };
}
