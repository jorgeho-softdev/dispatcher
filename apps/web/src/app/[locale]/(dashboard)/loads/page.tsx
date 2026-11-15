import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { LoadsTable } from '@/features/loads/LoadsTable';

export async function generateMetadata({ params }: PageProps<'/[locale]/loads'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.nav' });
  return { title: t('loads') };
}

export default async function Page({ params }: PageProps<'/[locale]/loads'>) {
  await resolveLocale(params);
  return <LoadsTable />;
}
