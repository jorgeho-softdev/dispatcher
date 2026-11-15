import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { LOCALE_INFO } from '@dispatcher/i18n';
import { routing } from '@/i18n/routing';
import { resolveLocale } from '@/i18n/params';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { brandFont } from '../fonts';
import '../globals.css';

// One static build per locale.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.meta' });
  return {
    title: { default: t('title'), template: `%s · AI Dispatcher` },
    description: t('description'),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const locale = await resolveLocale(params);

  return (
    <html lang={locale} dir={LOCALE_INFO[locale].dir} className={`${brandFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider>
          <StoreProvider>{children}</StoreProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
