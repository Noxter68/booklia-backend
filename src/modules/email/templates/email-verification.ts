// Email template: Email verification link.
// Sent to the user when they register or when an admin creates their account.

import { wrapInLayout, ctaButton } from './base-layout';

export interface EmailVerificationData {
  userName: string;
  verificationUrl: string;
}

export function buildEmailVerificationEmail(data: EmailVerificationData): {
  subject: string;
  html: string;
} {
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2D3436;">
      Confirmez votre adresse email
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#636E72;line-height:1.5;">
      Bonjour ${data.userName},<br>
      Cliquez sur le bouton ci-dessous pour vérifier votre adresse email.
      Ce lien expire dans 15 minutes.
    </p>

    ${ctaButton('Vérifier mon email', data.verificationUrl)}

    <p style="margin:24px 0 0;font-size:13px;color:#636E72;line-height:1.5;">
      Si vous n'avez pas créé de compte sur Booklia, vous pouvez ignorer cet email.
    </p>
  `;

  return {
    subject: 'Vérifiez votre adresse email — Booklia',
    html: wrapInLayout(content, 'Confirmez votre adresse email pour activer votre compte Booklia.'),
  };
}
