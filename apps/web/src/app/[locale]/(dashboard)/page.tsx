import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { DashboardOverview } from '@/features/dashboard/DashboardOverview';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.nav' });
  return { title: t('dashboard') };
}

export default async function DashboardPage({ params }: PageProps<'/[locale]'>) {
  await resolveLocale(params);
  return <DashboardOverview />;
}
