import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { VehiclesManager } from '@/features/vehicles/VehiclesManager';

export async function generateMetadata({ params }: PageProps<'/[locale]/vehicles'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.nav' });
  return { title: t('vehicles') };
}

export default async function Page({ params }: PageProps<'/[locale]/vehicles'>) {
  await resolveLocale(params);
  return <VehiclesManager />;
}
