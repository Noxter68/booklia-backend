// Email template: Email verification link.
// Sent to the user when they register or when an admin creates their account.

import { wrapInLayout, ctaButton } from './base-layout';
import { getEmailTranslations } from './i18n';

export interface EmailVerificationData {
  userName: string;
  verificationUrl: string;
  locale?: string;
}

export function buildEmailVerificationEmail(data: EmailVerificationData): {
  subject: string;
  html: string;
} {
  const locale = data.locale || 'fr';
  const t = getEmailTranslations(locale);

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D3436;">
      ${t.verifyEmailTitle}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#636E72;line-height:1.5;">
      ${t.verifyEmailBody(data.userName)}
    </p>

    ${ctaButton(t.verifyEmailCta, data.verificationUrl)}

    <p style="margin:24px 0 0;font-size:13px;color:#636E72;line-height:1.5;">
      ${t.verifyEmailFooter}
    </p>
  `;

  return {
    subject: t.verifyEmailSubject,
    html: wrapInLayout(content, t.verifyEmailPreview, locale),
  };
}
