// Email template: Admin invitation to verify identity.
// Sent when an admin manually creates a business account.

import { wrapInLayout, ctaButton } from './base-layout';
import { getEmailTranslations } from './i18n';

export interface AdminInvitationData {
  userName: string;
  appName: string;
  verificationUrl: string;
  locale?: string;
}

export function buildAdminInvitationEmail(data: AdminInvitationData): {
  subject: string;
  html: string;
} {
  const locale = data.locale || 'fr';
  const t = getEmailTranslations(locale);

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D3436;">
      ${t.adminInviteTitle}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#636E72;line-height:1.5;">
      ${t.adminInviteBody(data.userName, data.appName)}
    </p>

    ${ctaButton(t.adminInviteCta, data.verificationUrl)}

    <p style="margin:24px 0 0;font-size:13px;color:#636E72;line-height:1.5;">
      ${t.adminInviteFooter}
    </p>
  `;

  return {
    subject: t.adminInviteSubject(data.appName),
    html: wrapInLayout(content, t.adminInvitePreview(data.appName), locale),
  };
}
