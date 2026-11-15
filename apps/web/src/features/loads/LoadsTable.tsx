'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { EQUIPMENT_TYPES, formatMoney, type EquipmentType } from '@dispatcher/shared';
import { useIntlLocale } from '@/i18n/use-intl-locale';
import { useGetLoadsQuery } from '@/lib/store/api';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import {
  selectLoadsEquipmentFilter,
  selectShowSimulated,
  setLoadsEquipmentFilter,
  setShowSimulated,
} from '@/lib/store/ui-slice';
import { Badge, Card, ErrorState, PageHeader, Select } from '@/components/ui';

export function LoadsTable() {
  const t = useTranslations('web.loads');
  const tCommon = useTranslations('common');
  const tEquipment = useTranslations('domain.equipment');
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const dispatch = useAppDispatch();
  const equipment = useAppSelector(selectLoadsEquipmentFilter);
  const showSimulated = useAppSelector(selectShowSimulated);

  const { data, isLoading, isError, isFetching } = useGetLoadsQuery({
    limit: 100,
    ...(equipment !== 'all' && { equipment }),
    includeSimulated: showSimulated,
  });

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              aria-label={t('filterEquipment')}
              value={equipment}
              onChange={(e) => dispatch(setLoadsEquipmentFilter(e.target.value as EquipmentType | 'all'))}
            >
              <option value="all">{t('allEquipment')}</option>
              {EQUIPMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tEquipment(type)}
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
        }
      />

      {isError ? (
        <ErrorState message={tCommon('loadError')} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-start text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-5 py-3 text-start font-medium">{t('colRoute')}</th>
                <th className="px-5 py-3 text-start font-medium">{t('colPickup')}</th>
                <th className="px-5 py-3 text-start font-medium">{t('colEquipment')}</th>
                <th className="px-5 py-3 text-end font-medium">{t('colDistance')}</th>
                <th className="px-5 py-3 text-end font-medium">{t('colRate')}</th>
                <th className="px-5 py-3 text-end font-medium">{t('colProfit')}</th>
              </tr>
            </thead>
            <tbody className={isFetching ? 'opacity-60' : undefined}>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted">
                    {tCommon('loading')}
                  </td>
                </tr>
              )}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted">
                    {t('empty')}
                  </td>
                </tr>
              )}
              {data?.items.map((load) => (
                <tr key={load.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 font-semibold">
                      {load.originCity}, {load.originProvince} → {load.destinationCity}, {load.destinationProvince}
                      {load.isSimulated && <Badge tone="warning">{tCommon('demo')}</Badge>}
                    </div>
                    <p className="text-xs text-muted">{load.broker?.name ?? t('noBroker')}</p>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {format.dateTime(new Date(load.pickupAt), {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-3">{tEquipment(load.equipment)}</td>
                  <td className="px-5 py-3 text-end">{format.number(load.distanceKm)} km</td>
                  <td className="px-5 py-3 text-end">
                    <span className="font-semibold">{formatMoney(load.postedRate, load.currency, intlLocale)}</span>
                    <p className="text-xs text-muted">
                      {t('perKm', { amount: formatMoney(load.ratePerKm, load.currency, intlLocale) })}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-end font-semibold text-primary">
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
    </>
  );
}
