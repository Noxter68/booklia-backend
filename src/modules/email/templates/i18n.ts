// Centralized email translations for all supported locales.

export type EmailLocale = 'fr' | 'en' | 'pt';

const translations = {
  fr: {
    // Base layout
    autoEmail: 'Cet email a été envoyé automatiquement par Booklia.',
    allRightsReserved: 'Tous droits réservés.',
    hello: 'Bonjour',

    // Labels
    salon: 'Salon',
    service: 'Prestation',
    with: 'Avec',
    date: 'Date',
    time: 'Heure',
    duration: 'Durée',
    price: 'Prix',
    address: 'Adresse',
    canceledBy: 'Annulé par',
    min: 'min',

    // Booking accepted
    bookingConfirmedTitle: 'Rendez-vous confirmé !',
    bookingConfirmedBody: (clientName: string, businessName: string) =>
      `Bonjour ${clientName},<br>Bonne nouvelle ! <strong>${businessName}</strong> a accepté votre demande de rendez-vous.`,
    bookingConfirmedCta: 'Voir ma réservation',
    bookingConfirmedSubject: (businessName: string) =>
      `Rendez-vous confirmé chez ${businessName}`,
    bookingConfirmedPreview: (businessName: string) =>
      `Votre rendez-vous chez ${businessName} est confirmé !`,

    // Booking canceled
    bookingCanceledTitle: 'Rendez-vous annulé',
    bookingCanceledBody: (clientName: string, businessName: string) =>
      `Bonjour ${clientName},<br>Votre rendez-vous chez <strong>${businessName}</strong> a été annulé.`,
    bookingCanceledFooter: 'Vous pouvez reprendre rendez-vous à tout moment.',
    bookingCanceledCta: 'Reprendre rendez-vous',
    bookingCanceledSubject: (businessName: string) =>
      `Rendez-vous annulé — ${businessName}`,
    bookingCanceledPreview: (businessName: string) =>
      `Votre rendez-vous chez ${businessName} a été annulé.`,

    // Booking reminder
    bookingReminderTitle: 'Rappel : votre rendez-vous est demain !',
    bookingReminderBody: (clientName: string, businessName: string) =>
      `Bonjour ${clientName},<br>Nous vous rappelons votre rendez-vous chez <strong>${businessName}</strong> prévu demain.`,
    bookingReminderCta: 'Voir ma réservation',
    bookingReminderFooter:
      "En cas d'empêchement, pensez à annuler votre rendez-vous depuis l'application.",
    bookingReminderSubject: (businessName: string) =>
      `Rappel : rendez-vous demain chez ${businessName}`,
    bookingReminderPreview: (businessName: string) =>
      `Rappel : votre rendez-vous chez ${businessName} est demain !`,

    // Email verification
    verifyEmailTitle: 'Confirmez votre adresse email',
    verifyEmailBody: (userName: string) =>
      `Bonjour ${userName},<br>Cliquez sur le bouton ci-dessous pour vérifier votre adresse email. Ce lien expire dans 15 minutes.`,
    verifyEmailCta: 'Vérifier mon email',
    verifyEmailFooter:
      "Si vous n'avez pas créé de compte sur Booklia, vous pouvez ignorer cet email.",
    verifyEmailSubject: 'Vérifiez votre adresse email — Booklia',
    verifyEmailPreview:
      'Confirmez votre adresse email pour activer votre compte Booklia.',

    // Admin invitation
    adminInviteTitle: 'Vérifiez votre identité',
    adminInviteBody: (userName: string, appName: string) =>
      `Bonjour ${userName},<br>Un administrateur de ${appName} vous invite à vérifier votre identité. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email. Ce lien expire dans 24 heures.`,
    adminInviteCta: 'Vérifier mon identité',
    adminInviteFooter:
      "Si vous pensez avoir reçu cet email par erreur, vous pouvez l'ignorer.",
    adminInviteSubject: (appName: string) =>
      `Vérifiez votre identité — ${appName}`,
    adminInvitePreview: (appName: string) =>
      `Un administrateur de ${appName} vous invite à vérifier votre identité.`,
  },
  en: {
    autoEmail: 'This email was sent automatically by Booklia.',
    allRightsReserved: 'All rights reserved.',
    hello: 'Hello',

    salon: 'Business',
    service: 'Service',
    with: 'With',
    date: 'Date',
    time: 'Time',
    duration: 'Duration',
    price: 'Price',
    address: 'Address',
    canceledBy: 'Canceled by',
    min: 'min',

    bookingConfirmedTitle: 'Appointment confirmed!',
    bookingConfirmedBody: (clientName: string, businessName: string) =>
      `Hello ${clientName},<br>Great news! <strong>${businessName}</strong> has accepted your appointment request.`,
    bookingConfirmedCta: 'View my booking',
    bookingConfirmedSubject: (businessName: string) =>
      `Appointment confirmed at ${businessName}`,
    bookingConfirmedPreview: (businessName: string) =>
      `Your appointment at ${businessName} is confirmed!`,

    bookingCanceledTitle: 'Appointment canceled',
    bookingCanceledBody: (clientName: string, businessName: string) =>
      `Hello ${clientName},<br>Your appointment at <strong>${businessName}</strong> has been canceled.`,
    bookingCanceledFooter: 'You can book a new appointment at any time.',
    bookingCanceledCta: 'Book again',
    bookingCanceledSubject: (businessName: string) =>
      `Appointment canceled — ${businessName}`,
    bookingCanceledPreview: (businessName: string) =>
      `Your appointment at ${businessName} has been canceled.`,

    bookingReminderTitle: 'Reminder: your appointment is tomorrow!',
    bookingReminderBody: (clientName: string, businessName: string) =>
      `Hello ${clientName},<br>This is a reminder about your appointment at <strong>${businessName}</strong> scheduled for tomorrow.`,
    bookingReminderCta: 'View my booking',
    bookingReminderFooter:
      'If you need to cancel, please do so from the app.',
    bookingReminderSubject: (businessName: string) =>
      `Reminder: appointment tomorrow at ${businessName}`,
    bookingReminderPreview: (businessName: string) =>
      `Reminder: your appointment at ${businessName} is tomorrow!`,

    verifyEmailTitle: 'Confirm your email address',
    verifyEmailBody: (userName: string) =>
      `Hello ${userName},<br>Click the button below to verify your email address. This link expires in 15 minutes.`,
    verifyEmailCta: 'Verify my email',
    verifyEmailFooter:
      "If you didn't create an account on Booklia, you can ignore this email.",
    verifyEmailSubject: 'Verify your email address — Booklia',
    verifyEmailPreview:
      'Confirm your email address to activate your Booklia account.',

    adminInviteTitle: 'Verify your identity',
    adminInviteBody: (userName: string, appName: string) =>
      `Hello ${userName},<br>An administrator at ${appName} has invited you to verify your identity. Click the button below to confirm your email address. This link expires in 24 hours.`,
    adminInviteCta: 'Verify my identity',
    adminInviteFooter:
      'If you believe you received this email by mistake, you can ignore it.',
    adminInviteSubject: (appName: string) =>
      `Verify your identity — ${appName}`,
    adminInvitePreview: (appName: string) =>
      `An administrator at ${appName} has invited you to verify your identity.`,
  },
  pt: {
    autoEmail: 'Este email foi enviado automaticamente pelo Booklia.',
    allRightsReserved: 'Todos os direitos reservados.',
    hello: 'Olá',

    salon: 'Estabelecimento',
    service: 'Serviço',
    with: 'Com',
    date: 'Data',
    time: 'Horário',
    duration: 'Duração',
    price: 'Preço',
    address: 'Endereço',
    canceledBy: 'Cancelado por',
    min: 'min',

    bookingConfirmedTitle: 'Agendamento confirmado!',
    bookingConfirmedBody: (clientName: string, businessName: string) =>
      `Olá ${clientName},<br>Boa notícia! <strong>${businessName}</strong> aceitou sua solicitação de agendamento.`,
    bookingConfirmedCta: 'Ver minha reserva',
    bookingConfirmedSubject: (businessName: string) =>
      `Agendamento confirmado em ${businessName}`,
    bookingConfirmedPreview: (businessName: string) =>
      `Seu agendamento em ${businessName} foi confirmado!`,

    bookingCanceledTitle: 'Agendamento cancelado',
    bookingCanceledBody: (clientName: string, businessName: string) =>
      `Olá ${clientName},<br>Seu agendamento em <strong>${businessName}</strong> foi cancelado.`,
    bookingCanceledFooter: 'Você pode agendar novamente a qualquer momento.',
    bookingCanceledCta: 'Agendar novamente',
    bookingCanceledSubject: (businessName: string) =>
      `Agendamento cancelado — ${businessName}`,
    bookingCanceledPreview: (businessName: string) =>
      `Seu agendamento em ${businessName} foi cancelado.`,

    bookingReminderTitle: 'Lembrete: seu agendamento é amanhã!',
    bookingReminderBody: (clientName: string, businessName: string) =>
      `Olá ${clientName},<br>Este é um lembrete sobre seu agendamento em <strong>${businessName}</strong> marcado para amanhã.`,
    bookingReminderCta: 'Ver minha reserva',
    bookingReminderFooter:
      'Se precisar cancelar, faça isso pelo aplicativo.',
    bookingReminderSubject: (businessName: string) =>
      `Lembrete: agendamento amanhã em ${businessName}`,
    bookingReminderPreview: (businessName: string) =>
      `Lembrete: seu agendamento em ${businessName} é amanhã!`,

    verifyEmailTitle: 'Confirme seu endereço de email',
    verifyEmailBody: (userName: string) =>
      `Olá ${userName},<br>Clique no botão abaixo para verificar seu endereço de email. Este link expira em 15 minutos.`,
    verifyEmailCta: 'Verificar meu email',
    verifyEmailFooter:
      'Se você não criou uma conta no Booklia, pode ignorar este email.',
    verifyEmailSubject: 'Verifique seu endereço de email — Booklia',
    verifyEmailPreview:
      'Confirme seu endereço de email para ativar sua conta Booklia.',

    adminInviteTitle: 'Verifique sua identidade',
    adminInviteBody: (userName: string, appName: string) =>
      `Olá ${userName},<br>Um administrador do ${appName} convidou você a verificar sua identidade. Clique no botão abaixo para confirmar seu endereço de email. Este link expira em 24 horas.`,
    adminInviteCta: 'Verificar minha identidade',
    adminInviteFooter:
      'Se você acredita que recebeu este email por engano, pode ignorá-lo.',
    adminInviteSubject: (appName: string) =>
      `Verifique sua identidade — ${appName}`,
    adminInvitePreview: (appName: string) =>
      `Um administrador do ${appName} convidou você a verificar sua identidade.`,
  },
} as const;

export type EmailTranslations = {
  [K in keyof (typeof translations)['fr']]: (typeof translations)['fr'][K] extends (...args: any[]) => any
    ? (...args: Parameters<(typeof translations)['fr'][K]>) => string
    : string;
};

export function getEmailTranslations(
  locale: string = 'fr',
): EmailTranslations {
  const key = locale as keyof typeof translations;
  return (translations[key] || translations.fr) as unknown as EmailTranslations;
}

// Locale mappings for Intl formatters
const LOCALE_MAP: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  pt: 'pt-BR',
};

export function getIntlLocale(locale: string = 'fr'): string {
  return LOCALE_MAP[locale] || 'fr-FR';
}
