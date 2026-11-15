'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALES, LOCALE_INFO, type Locale } from '@dispatcher/i18n';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useUpdateMeMutation } from '@/lib/store/api';

/**
 * Switches the UI language (URL prefix + NEXT_LOCALE cookie). When signed in,
 * also saves it on the user profile so push/email use the same language.
 */
export function LanguageSwitcher({ persist = false }: { persist?: boolean }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [updateMe] = useUpdateMeMutation();

  function change(next: Locale) {
    if (persist) void updateMe({ locale: next });
    startTransition(() => router.replace(pathname, { locale: next }));
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span className="sr-only">{t('language')}</span>
      <select
        aria-label={t('language')}
        value={locale}
        disabled={pending}
        onChange={(e) => change(e.target.value as Locale)}
        className="rounded-xl border border-border bg-background px-2 py-2 text-sm text-ink focus:border-primary focus:outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_INFO[l].nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
