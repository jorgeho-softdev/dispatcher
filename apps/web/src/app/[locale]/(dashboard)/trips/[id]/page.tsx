import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { TripDetail } from '@/features/trips/TripDetail';

export async function generateMetadata({ params }: PageProps<'/[locale]/trips/[id]'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.trips' });
  return { title: t('title') };
}

// The id is request data: it streams in behind Suspense (Cache Components).
export default function TripPage({ params }: PageProps<'/[locale]/trips/[id]'>) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">…</p>}>
      <TripById params={params} />
    </Suspense>
  );
}

async function TripById({ params }: { params: PageProps<'/[locale]/trips/[id]'>['params'] }) {
  await resolveLocale(params);
  const { id } = await params;
  return <TripDetail id={id} />;
}
