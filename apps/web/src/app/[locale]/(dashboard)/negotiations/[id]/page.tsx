import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { NegotiationDetail } from '@/features/negotiations/NegotiationDetail';

export async function generateMetadata({ params }: PageProps<'/[locale]/negotiations/[id]'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'negotiation' });
  return { title: t('title') };
}

// The id is only known at request time, so it streams in behind Suspense
// while the dashboard shell is served from the prerender (Cache Components).
export default function NegotiationPage({ params }: PageProps<'/[locale]/negotiations/[id]'>) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">…</p>}>
      <NegotiationById params={params} />
    </Suspense>
  );
}

async function NegotiationById({ params }: { params: PageProps<'/[locale]/negotiations/[id]'>['params'] }) {
  await resolveLocale(params);
  const { id } = await params;
  return <NegotiationDetail id={id} />;
}
