// Generates an iCalendar (.ics) file for a booking, attached to confirmation
// and reminder emails so clients can add the appointment to any calendar app.

export interface IcsEventData {
  uid: string;
  scheduledAt: Date;
  durationMinutes: number;
  serviceName: string;
  businessName: string;
  employeeName: string;
  address: string;
  city: string;
  postalCode?: string;
}

function formatIcsDate(date: Date): string {
  // YYYYMMDDTHHMMSSZ in UTC
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcsText(text: string): string {
  // RFC 5545: escape backslash, semicolon, comma, newline
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  // RFC 5545 §3.1: lines longer than 75 octets must be folded with CRLF + space
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  parts.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    parts.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return parts.join('\r\n');
}

export function buildBookingIcs(data: IcsEventData): Buffer {
  const start = data.scheduledAt;
  const end = new Date(start.getTime() + data.durationMinutes * 60_000);
  const now = new Date();

  const summary = `${data.serviceName} — ${data.businessName}`;
  const location = [data.address, data.postalCode, data.city]
    .filter(Boolean)
    .join(', ');
  const description = `${data.serviceName} avec ${data.employeeName} chez ${data.businessName}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Booklia//Booking//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${data.uid}@booklia.fr`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT1H',
    `DESCRIPTION:${escapeIcsText(summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(foldLine);

  return Buffer.from(lines.join('\r\n'), 'utf-8');
}
