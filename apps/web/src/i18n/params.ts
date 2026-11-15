import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@dispatcher/i18n';
import { routing } from './routing';

/**
 * Resolves and validates the [locale] route param, and enables static
 * rendering for it. Call at the top of every page / layout / generateMetadata.
 */
export async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
