// Email template: Booking accepted by the salon.
// Sent to the client (requester) when a provider accepts their booking.

import { wrapInLayout, ctaButton, detailRow, detailsTable } from './base-layout';
import { formatDate, formatTime, formatPrice } from './helpers';

export interface BookingAcceptedData {
  clientName: string;
  businessName: string;
  serviceName: string;
  employeeName: string;
  scheduledAt: Date;
  durationMinutes: number;
  priceCents: number;
  address: string;
  city: string;
  frontendUrl: string;
}

export function buildBookingAcceptedEmail(data: BookingAcceptedData): {
  subject: string;
  html: string;
} {
  const rows = [
    detailRow('Salon', data.businessName),
    detailRow('Prestation', data.serviceName),
    detailRow('Avec', data.employeeName),
    detailRow('Date', formatDate(data.scheduledAt)),
    detailRow('Heure', formatTime(data.scheduledAt)),
    detailRow('Durée', `${data.durationMinutes} min`),
    detailRow('Prix', formatPrice(data.priceCents)),
    detailRow('Adresse', `${data.address}, ${data.city}`),
  ].join('');

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D3436;">
      Rendez-vous confirmé !
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#636E72;line-height:1.5;">
      Bonjour ${data.clientName},<br>
      Bonne nouvelle ! <strong>${data.businessName}</strong> a accepté votre demande de rendez-vous.
    </p>

    ${detailsTable(rows)}

    ${ctaButton('Voir ma réservation', `${data.frontendUrl}/mes-reservations`)}
  `;

  return {
    subject: `Rendez-vous confirmé chez ${data.businessName}`,
    html: wrapInLayout(content, `Votre rendez-vous chez ${data.businessName} est confirmé !`),
  };
}
