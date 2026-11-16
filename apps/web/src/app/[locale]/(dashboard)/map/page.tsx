import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { LiveMap } from '@/features/map/LiveMap';

export async function generateMetadata({ params }: PageProps<'/[locale]/map'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.map' });
  return { title: t('title') };
}

export default async function MapPage({ params }: PageProps<'/[locale]/map'>) {
  await resolveLocale(params);
  return <LiveMap />;
}
