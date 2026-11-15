import type { Locale, Messages } from '@dispatcher/i18n';

// Type-safe translations: keys are checked against the English source catalog.
declare module 'use-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
