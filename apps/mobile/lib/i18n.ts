import { getCalendars, getLocales } from 'expo-localization';
import { createTranslator } from 'use-intl';
import {
  getMessages,
  LOCALE_INFO,
  LOCALES,
  negotiateLocale,
  type Locale,
  type Messages,
} from '@dispatcher/i18n';

// Translations come from the shared catalogs in packages/i18n (the same files
// the web admin uses). In components use `useTranslations('mobile.home')`
// from 'use-intl'; outside React use `translatorFor()`. See docs/i18n.md.

export type { Locale };

/** Language picker options: native names, never flags (languages aren't countries). */
export const LANGUAGE_OPTIONS = LOCALES.map((key) => ({ key, label: LOCALE_INFO[key].nativeName }));

/** Best supported locale for the device's preferred languages (e.g. pa-IN → pa). */
export function deviceLocale(): Locale {
  return negotiateLocale(getLocales().map((l) => l.languageTag));
}

/** Device time zone (drivers cross provinces/time zones). */
export function deviceTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? 'America/Edmonton';
}

/** BCP-47 tag for Intl/money formatting of a locale. */
export function intlLocaleOf(locale: Locale): string {
  return LOCALE_INFO[locale].intlLocale;
}

/** Translator for code outside React (notifications, background tasks). */
export function translatorFor<N extends keyof Messages>(locale: Locale, namespace: N) {
  return createTranslator({ locale, messages: getMessages(locale), namespace, timeZone: deviceTimeZone() });
}
