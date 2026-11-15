'use client';

import { useLocale } from 'next-intl';
import { LOCALE_INFO } from '@dispatcher/i18n';

/** BCP-47 tag for Intl formatting of the active locale (e.g. "fr-CA"). */
export function useIntlLocale(): string {
  return LOCALE_INFO[useLocale()].intlLocale;
}
