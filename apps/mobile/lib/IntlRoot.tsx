import { type ReactNode } from 'react';
import { IntlProvider } from 'use-intl';
import { getMessages } from '@dispatcher/i18n';
import { useAppSelector } from '@/store/hooks';
import { selectLanguage } from '@/store/settings-slice';
import { deviceTimeZone } from './i18n';

const timeZone = deviceTimeZone();

/** Provides the user's chosen language to every `useTranslations()` call. */
export function IntlRoot({ children }: { children: ReactNode }) {
  const locale = useAppSelector(selectLanguage);
  return (
    <IntlProvider
      locale={locale}
      messages={getMessages(locale)}
      timeZone={timeZone}
      // A missing key shows the key path instead of crashing; catalogs are
      // verified for completeness by packages/i18n tests.
      onError={(error) => {
        if (__DEV__) console.warn(`[i18n] ${error.message}`);
      }}
    >
      {children}
    </IntlProvider>
  );
}
