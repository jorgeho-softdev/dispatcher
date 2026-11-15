'use client';

import { useTranslations } from 'next-intl';
import { formatMoney } from '@dispatcher/shared';
import { Link } from '@/i18n/navigation';
import { useIntlLocale } from '@/i18n/use-intl-locale';
import { useGetLoadsQuery, useGetMeQuery, useGetVehiclesQuery } from '@/lib/store/api';
import { Card, PageHeader } from '@/components/ui';

export function DashboardOverview() {
  const t = useTranslations('web.dashboard');
  const intlLocale = useIntlLocale();
  const { data: me } = useGetMeQuery();
  const { data: loads } = useGetLoadsQuery({ limit: 100 });
  const { data: vehicles } = useGetVehiclesQuery();

  const items = loads?.items ?? [];
  const profitable = items.filter((l) => (l.estimatedProfit ?? 0) > 0);
  const best = [...profitable].sort((a, b) => (b.estimatedProfit ?? 0) - (a.estimatedProfit ?? 0))[0];
  const count = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString(intlLocale));

  const stats = [
    { label: t('availableLoads'), value: count(loads ? items.length : undefined) },
    { label: t('withProfit'), value: count(loads ? profitable.length : undefined) },
    { label: t('vehicles'), value: count(vehicles?.length) },
    { label: t('bestProfit'), value: best ? formatMoney(best.estimatedProfit ?? 0, best.currency, intlLocale) : '—' },
  ];

  return (
    <>
      <PageHeader title={t('greeting', { name: me?.user.name.split(' ')[0] ?? '' })} subtitle={t('subtitle')} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-2 text-2xl font-bold">{s.value}</p>
          </Card>
        ))}
      </div>
      {vehicles?.length === 0 && (
        <Card className="mt-6 border-primary/40">
          <p className="text-sm">
            {t('addVehicleHint')}{' '}
            <Link href="/vehicles" className="font-semibold text-primary">
              {t('addVehicleCta')}
            </Link>
          </p>
        </Card>
      )}
    </>
  );
}
