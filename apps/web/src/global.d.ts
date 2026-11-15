import type { Locale, Messages } from '@dispatcher/i18n';

// Type-safe translations: t('web.loads.title') is checked against the English
// source catalog, and locale values against the supported locales.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
