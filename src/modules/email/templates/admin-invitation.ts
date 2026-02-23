// Email template: Admin invitation to verify identity.
// Sent when an admin manually creates a business account.

import { wrapInLayout, ctaButton } from './base-layout';

export interface AdminInvitationData {
  userName: string;
  appName: string;
  verificationUrl: string;
}

export function buildAdminInvitationEmail(data: AdminInvitationData): {
  subject: string;
  html: string;
} {
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D3436;">
      Vérifiez votre identité
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#636E72;line-height:1.5;">
      Bonjour ${data.userName},<br>
      Un administrateur de ${data.appName} vous invite à vérifier votre identité.
      Cliquez sur le bouton ci-dessous pour confirmer votre adresse email.
      Ce lien expire dans 24 heures.
    </p>

    ${ctaButton('Vérifier mon identité', data.verificationUrl)}

    <p style="margin:24px 0 0;font-size:13px;color:#636E72;line-height:1.5;">
      Si vous pensez avoir reçu cet email par erreur, vous pouvez l'ignorer.
    </p>
  `;

  return {
    subject: `Vérifiez votre identité — ${data.appName}`,
    html: wrapInLayout(content, `Un administrateur de ${data.appName} vous invite à vérifier votre identité.`),
  };
}
