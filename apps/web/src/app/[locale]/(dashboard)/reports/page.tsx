import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { ReportsView } from '@/features/reports/ReportsView';

export async function generateMetadata({ params }: PageProps<'/[locale]/reports'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.reports' });
  return { title: t('title') };
}

export default async function ReportsPage({ params }: PageProps<'/[locale]/reports'>) {
  await resolveLocale(params);
  return (
    <Suspense fallback={<p className="text-sm text-muted">…</p>}>
      <ReportsAtRequestTime />
    </Suspense>
  );
}

// "Now" must be the request time, not the build time (Cache Components):
// connection() defers this part to request time.
async function ReportsAtRequestTime() {
  await connection();
  return <ReportsView nowIso={new Date().toISOString()} />;
}
