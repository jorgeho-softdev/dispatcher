import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { LoadForm } from '@/features/loads/LoadForm';

export async function generateMetadata({ params }: PageProps<'/[locale]/loads/new'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.loadForm' });
  return { title: t('title') };
}

export default async function NewLoadPage({ params }: PageProps<'/[locale]/loads/new'>) {
  await resolveLocale(params);
  return <LoadForm />;
}
