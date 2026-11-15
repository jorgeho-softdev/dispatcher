'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { EQUIPMENT_TYPES, LOAD_VIEWS, can, formatMoney, type EquipmentType } from '@dispatcher/shared';
import { Link } from '@/i18n/navigation';
import { useIntlLocale } from '@/i18n/use-intl-locale';
import { useGetLoadPagesInfiniteQuery, useGetMeQuery } from '@/lib/store/api';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import {
  selectLoadsEquipmentFilter,
  selectLoadsView,
  selectShowSimulated,
  setLoadsEquipmentFilter,
  setLoadsView,
  setShowSimulated,
} from '@/lib/store/ui-slice';
import { Badge, Button, Card, ErrorState, PageHeader, Select } from '@/components/ui';
import { MatchBadge } from './MatchBadge';

const PAGE_SIZE = 50;

export function LoadsTable() {
  const t = useTranslations('web.loads');
  const tCommon = useTranslations('common');
  const tDomain = useTranslations('domain');
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const dispatch = useAppDispatch();
  const view = useAppSelector(selectLoadsView);
  const equipment = useAppSelector(selectLoadsEquipmentFilter);
  const showSimulated = useAppSelector(selectShowSimulated);
  const { data: me } = useGetMeQuery();

  // Changing view/filters creates a new query (and resets to page 1).
  const { data, isLoading, isError, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useGetLoadPagesInfiniteQuery({
      view,
      limit: PAGE_SIZE,
      ...(equipment !== 'all' && { equipment }),
      includeSimulated: showSimulated,
    });
  const ctx = data?.pages[0]?.context;
  const items = data?.pages.flatMap((p) => p.items);
  const changeView = (next: (typeof LOAD_VIEWS)[number]) => dispatch(setLoadsView(next));

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          can(me?.role, 'loads:create') && (
            <Link href="/loads/new">
              <Button>{t('newLoad')}</Button>
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-2">
          {LOAD_VIEWS.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => changeView(v)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                view === v ? 'border-primary bg-primary text-on-primary' : 'border-border text-ink hover:bg-surface-raised'
              }`}
            >
              {tDomain(`loadView.${v}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            aria-label={t('filterEquipment')}
            value={equipment}
            onChange={(e) => dispatch(setLoadsEquipmentFilter(e.target.value as EquipmentType | 'all'))}
          >
            <option value="all">{t('allEquipment')}</option>
            {EQUIPMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {tDomain(`equipment.${type}`)}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={showSimulated}
              onChange={(e) => dispatch(setShowSimulated(e.target.checked))}
              className="accent-primary"
            />
            {t('includeDemo')}
          </label>
        </div>
      </div>

      {ctx && (
        <p className="mb-3 text-xs text-muted">
          {!ctx.vehicle
            ? t('noVehicleMatch')
            : !ctx.positionSource
              ? t('noPosition')
              : t('matchingFor', {
                  vehicle: ctx.vehicle.name,
                  source: tDomain(`positionSource.${ctx.positionSource}`),
                })}
        </p>
      )}

      {isError ? (
        <ErrorState message={tCommon('loadError')} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-start text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('colMatch')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('colRoute')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('colPickup')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('colEquipment')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('colDistance')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('colDeadhead')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('colRate')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('colProfit')}</th>
              </tr>
            </thead>
            <tbody className={isFetching ? 'opacity-60' : undefined}>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    {tCommon('loading')}
                  </td>
                </tr>
              )}
              {items?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    {t('empty')}
                  </td>
                </tr>
              )}
              {items?.map((load) => (
                <tr key={load.id} className="border-b border-border/60 align-top last:border-0">
                  <td className="px-4 py-3">
                    <MatchBadge match={load.match} />
                    {load.match && load.match.reasons.length > 0 && (
                      <p className="mt-1 max-w-[180px] text-[11px] leading-snug text-muted">
                        {load.match.reasons
                          .slice(0, 2)
                          .map((r) => tDomain(`matchReason.${r.code}`))
                          .join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold">
                      {load.originCity}, {load.originProvince} → {load.destinationCity}, {load.destinationProvince}
                      {load.isSimulated && <Badge tone="warning">{tCommon('demo')}</Badge>}
                    </div>
                    <p className="text-xs text-muted">{load.broker?.name ?? t('noBroker')}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {format.dateTime(new Date(load.pickupAt), {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">{tDomain(`equipment.${load.equipment}`)}</td>
                  <td className="px-4 py-3 text-end">{format.number(load.distanceKm)} km</td>
                  <td className="px-4 py-3 text-end text-muted">
                    {load.deadheadKm === null ? '—' : `${format.number(Math.round(load.deadheadKm))} km`}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <span className="font-semibold">{formatMoney(load.postedRate, load.currency, intlLocale)}</span>
                    <p className="text-xs text-muted">
                      {t('perKm', { amount: formatMoney(load.ratePerKm, load.currency, intlLocale) })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-end font-semibold text-primary">
                    {load.estimatedProfit === null ? (
                      <span className="text-xs font-normal text-muted">{t('noVehicle')}</span>
                    ) : (
                      formatMoney(load.estimatedProfit, load.currency, intlLocale)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            {t('loadMore')}
          </Button>
        </div>
      )}
    </>
  );
}
