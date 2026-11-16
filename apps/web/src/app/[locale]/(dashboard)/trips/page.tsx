import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { TripsList } from '@/features/trips/TripsList';

export async function generateMetadata({ params }: PageProps<'/[locale]/trips'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.trips' });
  return { title: t('title') };
}

export default async function TripsPage({ params }: PageProps<'/[locale]/trips'>) {
  await resolveLocale(params);
  return <TripsList />;
}
