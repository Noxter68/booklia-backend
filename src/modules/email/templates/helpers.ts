// Shared formatting helpers for email templates.

import { getIntlLocale } from './i18n';

/**
 * Formats a date as "Lundi 24 février 2026" (locale-aware).
 */
export function formatDate(date: Date, locale: string = 'fr'): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats a date's time as "14h30" (FR) or "2:30 PM" (EN/PT).
 */
export function formatTime(date: Date, locale: string = 'fr'): string {
  if (locale === 'fr') {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}h${minutes}`;
  }
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Formats price in cents to "25,00 €" (locale-aware).
 */
export function formatPrice(priceCents: number, locale: string = 'fr'): string {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: 'currency',
    currency: 'EUR',
  }).format(priceCents / 100);
}
