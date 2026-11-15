import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { getMessages } from '@dispatcher/i18n';
import { routing } from './routing';

// Messages come from the shared catalogs in packages/i18n (same files the
// mobile app uses).
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: getMessages(locale),
    // Launch region (Alberta). Per-user time zones arrive with user profiles.
    timeZone: 'America/Edmonton',
  };
});
