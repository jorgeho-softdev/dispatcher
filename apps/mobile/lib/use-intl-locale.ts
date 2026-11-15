import { useLocale } from 'use-intl';
import { intlLocaleOf } from './i18n';

/** BCP-47 tag of the active language for money/number formatting (e.g. "fr-CA"). */
export function useIntlLocale(): string {
  return intlLocaleOf(useLocale());
}
