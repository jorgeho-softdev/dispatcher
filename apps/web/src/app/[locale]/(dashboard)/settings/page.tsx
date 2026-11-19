import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { PreferencesForm } from '@/features/settings/PreferencesForm';

export async function generateMetadata({ params }: PageProps<'/[locale]/settings'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.settings' });
  return { title: t('title') };
}

export default async function SettingsPage({ params }: PageProps<'/[locale]/settings'>) {
  await resolveLocale(params);
  return <PreferencesForm />;
}
