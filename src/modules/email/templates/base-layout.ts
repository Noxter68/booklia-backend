// Shared HTML email layout for all Booklia transactional emails.
// Uses inline styles for maximum email client compatibility.

import { getEmailTranslations, type EmailLocale } from './i18n';

const BRAND_COLOR = '#1A1A1A';
const BRAND_COLOR_DARK = '#000000';
const TEXT_COLOR = '#2D3436';
const TEXT_MUTED = '#636E72';
const BG_COLOR = '#F8F9FA';
const CARD_BG = '#FFFFFF';

/**
 * Wraps email content in the Booklia branded layout (header + footer).
 */
export function wrapInLayout(
  content: string,
  previewText: string,
  locale: string = 'fr',
): string {
  const t = getEmailTranslations(locale);
  const langAttr = locale === 'pt' ? 'pt-BR' : locale;

  return `
<!DOCTYPE html>
<html lang="${langAttr}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Booklia</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- Preview text (hidden in email body, visible in inbox preview) -->
  <div style="display:none;max-height:0;overflow:hidden;">
    ${previewText}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:24px 0 16px;">
              <span style="font-size:28px;font-weight:700;color:${BRAND_COLOR};letter-spacing:-0.5px;">
                Booklia
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:${CARD_BG};border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 0 0;">
              <p style="margin:0 0 8px;font-size:13px;color:${TEXT_MUTED};">
                ${t.autoEmail}
              </p>
              <p style="margin:0;font-size:13px;color:${TEXT_MUTED};">
                &copy; ${new Date().getFullYear()} Booklia. ${t.allRightsReserved}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`.trim();
}

/**
 * Returns a styled CTA button.
 */
export function ctaButton(text: string, href: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
  <tr>
    <td align="center" style="background-color:${BRAND_COLOR};border-radius:8px;">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:12px 32px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">
        ${text}
      </a>
    </td>
  </tr>
</table>`.trim();
}

/**
 * Returns a styled detail row (label + value) for booking info.
 */
export function detailRow(label: string, value: string): string {
  return `
<tr>
  <td style="padding:8px 0;font-size:14px;color:${TEXT_MUTED};width:140px;vertical-align:top;">
    ${label}
  </td>
  <td style="padding:8px 0;font-size:14px;color:${TEXT_COLOR};font-weight:500;">
    ${value}
  </td>
</tr>`.trim();
}

/**
 * Wraps multiple detail rows in a styled table.
 */
export function detailsTable(rows: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
  ${rows}
</table>`.trim();
}

export { BRAND_COLOR, BRAND_COLOR_DARK, TEXT_COLOR, TEXT_MUTED };
