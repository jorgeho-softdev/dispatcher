import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { NegotiationsList } from '@/features/negotiations/NegotiationsList';

export async function generateMetadata({ params }: PageProps<'/[locale]/negotiations'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.negotiations' });
  return { title: t('title') };
}

export default async function NegotiationsPage({ params }: PageProps<'/[locale]/negotiations'>) {
  await resolveLocale(params);
  return <NegotiationsList />;
}
