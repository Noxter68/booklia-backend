// Email template: Invoice sent by the business to the client.

import { wrapInLayout, detailRow, detailsTable } from './base-layout';
import { formatDate, formatPrice } from './helpers';
import { getEmailTranslations } from './i18n';

export interface InvoiceSentData {
  clientName: string;
  businessName: string;
  invoiceNumber: string;
  issueDate: Date;
  totalTTCCents: number;
  locale?: string;
}

export function buildInvoiceSentEmail(data: InvoiceSentData): {
  subject: string;
  html: string;
} {
  const locale = data.locale || 'fr';
  const t = getEmailTranslations(locale);

  const rows = [
    detailRow(t.invoiceNumber, data.invoiceNumber),
    detailRow(t.invoiceDate, formatDate(data.issueDate, locale)),
    detailRow(t.invoiceTotal, formatPrice(data.totalTTCCents, locale)),
  ].join('');

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D3436;">
      ${t.invoiceSentTitle}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#636E72;line-height:1.5;">
      ${t.invoiceSentBody(data.clientName, data.businessName, data.invoiceNumber)}
    </p>

    ${detailsTable(rows)}

    <p style="margin:20px 0 0;font-size:14px;color:#636E72;line-height:1.5;">
      ${t.invoiceSentFooter}
    </p>
  `;

  return {
    subject: t.invoiceSentSubject(data.businessName, data.invoiceNumber),
    html: wrapInLayout(content, t.invoiceSentPreview(data.businessName), locale),
  };
}
