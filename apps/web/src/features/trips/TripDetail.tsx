'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { ACTIVE_TRIP_STATUSES, TRIP_PROGRESS, can, formatMoney } from '@dispatcher/shared';
import { Link } from '@/i18n/navigation';
import { useIntlLocale } from '@/i18n/use-intl-locale';
import {
  useAssignTripDriverMutation,
  useGetDocumentDownloadUrlMutation,
  useGetMeQuery,
  useGetMembersQuery,
  useGetTripQuery,
} from '@/lib/store/api';
import { Badge, Button, Card, ErrorState, PageHeader, Select } from '@/components/ui';

const ORDER = ['scheduled', 'at_pickup', 'in_transit', 'delivered', 'completed'];

/** Trip overview for the back office: progress, real financials, documents, expenses. */
export function TripDetail({ id }: { id: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const { data: trip, isLoading, isError } = useGetTripQuery(id, { pollingInterval: 30_000 });
  const [getDownloadUrl, { isLoading: opening }] = useGetDocumentDownloadUrlMutation();
  const { data: me } = useGetMeQuery();
  const canManage = can(me?.role, 'trips:manage');
  const { data: members } = useGetMembersQuery(undefined, { skip: !canManage });
  const [assignDriver, { isLoading: assigning }] = useAssignTripDriverMutation();

  if (isError) return <ErrorState message={t('common.loadError')} />;
  if (isLoading || !trip) return <p className="text-sm text-muted">{t('common.loading')}</p>;

  const money = (v: number) => formatMoney(v, trip.financials.currency, intlLocale);
  const f = trip.financials;
  const current = ORDER.indexOf(trip.status);
  const open = async (docId: string) => {
    const r = await getDownloadUrl(docId);
    if (r.data) window.open(r.data.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Link href="/trips" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        {t('web.trips.back')}
      </Link>
      <PageHeader
        title={t('trip.title', { code: trip.code })}
        subtitle={`${trip.load.originCity}, ${trip.load.originProvince} → ${trip.load.destinationCity}, ${trip.load.destinationProvince} · ${trip.vehicle.name}`}
        actions={
          <div className="flex items-center gap-2">
            {trip.load.isSimulated && <Badge tone="warning">{t('common.demo')}</Badge>}
            <Badge tone="primary">{t(`domain.tripStatus.${trip.status}`)}</Badge>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-semibold">{t('web.trips.progress')}</h2>
            <ol className="flex items-center gap-2">
              {TRIP_PROGRESS.map((step, i) => {
                const done = current > ORDER.indexOf(step);
                const active = current === ORDER.indexOf(step);
                return (
                  <li key={step} className="flex flex-1 items-center gap-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done ? 'bg-primary text-on-primary' : active ? 'border-2 border-primary text-primary' : 'border-2 border-border text-muted'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span className={`text-sm ${active ? 'font-semibold text-primary' : 'text-muted'}`}>{t(`domain.tripStep.${step}`)}</span>
                    {i < TRIP_PROGRESS.length - 1 && <span className={`h-0.5 flex-1 ${done ? 'bg-primary' : 'bg-border'}`} />}
                  </li>
                );
              })}
            </ol>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted">{t('trip.eta')}</p>
                <p className="font-semibold">
                  {trip.etaAt ? format.dateTime(new Date(trip.etaAt), { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">{t('trip.remaining')}</p>
                <p className="font-semibold">{trip.remainingKm !== null ? `${format.number(Math.round(trip.remainingKm))} km` : '—'}</p>
              </div>
              <p className="col-span-2 self-end text-xs text-muted sm:col-span-1">
                {trip.lastPosition
                  ? t('trip.lastUpdate', { time: format.relativeTime(new Date(trip.lastPosition.at)) })
                  : t('trip.noPosition')}
              </p>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">{t('trip.documents')}</h2>
            {trip.documents.length === 0 && <p className="text-sm text-muted">—</p>}
            <ul className="divide-y divide-border">
              {trip.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    {t(`domain.documentType.${d.type}`)}
                    <span className="ms-2 text-xs text-muted">
                      {format.dateTime(new Date(d.createdAt), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                  <Button variant="secondary" disabled={opening} onClick={() => void open(d.id)}>
                    {t('web.trips.download')}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">{t('trip.expenses')}</h2>
            {trip.expenses.length === 0 && <p className="text-sm text-muted">{t('trip.noExpenses')}</p>}
            <ul className="divide-y divide-border text-sm">
              {trip.expenses.map((e) => (
                <li key={e.id} className="flex justify-between py-2">
                  <span>
                    {t(`domain.expenseCategory.${e.category}`)}
                    {e.note && <span className="ms-2 text-xs text-muted">{e.note}</span>}
                  </span>
                  <span className="font-semibold">{money(e.amount)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="h-fit space-y-2 text-sm">
          <div className="mb-4">
            <p className="text-xs text-muted">{t('web.trips.driver')}</p>
            {canManage && ACTIVE_TRIP_STATUSES.includes(trip.status) && members ? (
              <Select
                aria-label={t('web.trips.assignDriver')}
                className="mt-1 w-full"
                value={trip.driver.id}
                disabled={assigning}
                onChange={(e) => void assignDriver({ id: trip.id, driverId: e.target.value })}
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} · {t(`domain.role.${m.role}`)}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="font-semibold">{trip.driver.name}</p>
            )}
          </div>
          <h2 className="mb-2 font-semibold">{t('web.trips.financials')}</h2>
          <Row label={t('trip.finalRate')} value={money(f.rate)} />
          <Row label={t('trip.actualExpenses')} value={`− ${money(f.actualExpenses)}`} />
          <Row label={t('trip.actualProfit')} value={money(f.actualProfit)} strong />
          <Row label={t('trip.finalMargin')} value={format.number(f.actualMarginPct / 100, { style: 'percent', maximumFractionDigits: 1 })} strong />
          <p className="pt-2 text-xs text-muted">
            {t('trip.estimatedProfit')}: {money(f.estimatedProfit)}
          </p>
          {trip.brokerRating && (
            <p className="pt-2 text-sm">
              {'★'.repeat(trip.brokerRating.stars)}
              <span className="text-muted">{'★'.repeat(5 - trip.brokerRating.stars)}</span>
              {trip.load.brokerName && <span className="ms-2 text-xs text-muted">{trip.load.brokerName}</span>}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={strong ? 'font-bold text-primary' : 'font-semibold'}>{value}</span>
    </div>
  );
}
