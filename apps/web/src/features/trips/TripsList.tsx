'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { formatMoney, type TripListQuery } from '@dispatcher/shared';
import { Link } from '@/i18n/navigation';
import { useIntlLocale } from '@/i18n/use-intl-locale';
import { useGetTripsQuery } from '@/lib/store/api';
import { Badge, Card, ErrorState, PageHeader } from '@/components/ui';

export function TripsList() {
  const t = useTranslations();
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const [filter, setFilter] = useState<TripListQuery['filter']>('active');
  const { data, isLoading, isError } = useGetTripsQuery({ filter }, { pollingInterval: 30_000 });
  const filters = [
    { value: 'active', label: t('trip.filterActive') },
    { value: 'completed', label: t('trip.filterCompleted') },
    { value: 'all', label: t('web.trips.filterAll') },
  ] as const;

  return (
    <>
      <PageHeader title={t('web.trips.title')} subtitle={t('web.trips.subtitle')} />
      <div role="tablist" className="mb-4 flex gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
              filter === f.value ? 'border-primary bg-primary text-on-primary' : 'border-border text-ink hover:bg-surface-raised'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {isError ? (
        <ErrorState message={t('common.loadError')} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-start text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('web.trips.colCode')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('web.trips.colRoute')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('web.trips.colStatus')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('web.trips.colEta')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('web.trips.colRate')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('web.trips.colProfit')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    {t('common.loading')}
                  </td>
                </tr>
              )}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    {t('trip.noTrips')}
                  </td>
                </tr>
              )}
              {data?.map((trip) => (
                <tr key={trip.id} className="border-b border-border/60 last:border-0 hover:bg-surface-raised/50">
                  <td className="px-4 py-3">
                    <Link href={`/trips/${trip.id}`} className="font-semibold hover:text-primary">
                      #{trip.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {trip.load.originCity}, {trip.load.originProvince} → {trip.load.destinationCity}, {trip.load.destinationProvince}
                    {trip.load.isSimulated && (
                      <span className="ms-2">
                        <Badge tone="warning">{t('common.demo')}</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={trip.status === 'completed' || trip.status === 'cancelled' ? 'neutral' : 'primary'}>
                      {t(`domain.tripStatus.${trip.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-end text-muted">
                    {trip.etaAt ? format.dateTime(new Date(trip.etaAt), { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-end">{formatMoney(trip.financials.rate, trip.financials.currency, intlLocale)}</td>
                  <td className="px-4 py-3 text-end font-semibold text-primary">
                    {formatMoney(trip.financials.actualProfit, trip.financials.currency, intlLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
