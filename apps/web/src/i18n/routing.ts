import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@dispatcher/i18n';

// Every page lives under /<locale>/… (e.g. /pa/loads). Explicit locale URLs
// keep pages statically prerenderable with Cache Components and make links
// shareable in a given language. Locales come from @dispatcher/i18n.
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  // Remembers the user's choice; first visit negotiates from Accept-Language.
  localeCookie: { name: 'NEXT_LOCALE', maxAge: 60 * 60 * 24 * 365 },
});
