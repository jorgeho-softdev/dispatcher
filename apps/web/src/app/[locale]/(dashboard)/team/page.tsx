import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { TeamManager } from '@/features/team/TeamManager';

export async function generateMetadata({ params }: PageProps<'/[locale]/team'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.team' });
  return { title: t('title') };
}

export default async function TeamPage({ params }: PageProps<'/[locale]/team'>) {
  await resolveLocale(params);
  return <TeamManager />;
}
