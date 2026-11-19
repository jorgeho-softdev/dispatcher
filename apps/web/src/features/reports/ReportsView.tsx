'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { REPORT_GROUPS, can, formatMoney, type ReportGroup } from '@dispatcher/shared';
import { useIntlLocale } from '@/i18n/use-intl-locale';
import { useGetAiPerformanceQuery, useGetMeQuery, useGetReportSummaryQuery } from '@/lib/store/api';
import { Card, ErrorState, PageHeader, Select } from '@/components/ui';
import { BarChart } from './BarChart';

const RANGES = { last30: 30, last90: 90, last365: 365 } as const;
type RangeKey = keyof typeof RANGES;

/** Stable range: end of "today" (request time) minus N days → end of today. */
function rangeOf(nowIso: string, days: number) {
  const to = new Date(nowIso);
  to.setHours(24, 0, 0, 0);
  return { from: new Date(to.getTime() - days * 86_400_000), to };
}

export function ReportsView({ nowIso }: { nowIso: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const { data: me } = useGetMeQuery();
  const [rangeKey, setRangeKey] = useState<RangeKey>('last90');
  const [groupBy, setGroupBy] = useState<ReportGroup>('month');
  const range = useMemo(() => rangeOf(nowIso, RANGES[rangeKey]), [nowIso, rangeKey]);
  const allowed = can(me?.role, 'finances:read');

  const { data, isError, isFetching } = useGetReportSummaryQuery({ ...range, groupBy }, { skip: !allowed });
  const { data: ai } = useGetAiPerformanceQuery(range, { skip: !allowed });

  if (me && !allowed) return <ErrorState message={t('errors.FORBIDDEN')} />;
  const money = (v: number) => formatMoney(v, data?.currency ?? 'CAD', intlLocale);
  const pct = (v: number) => format.number(v / 100, { style: 'percent', maximumFractionDigits: 1 });
  const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return format.dateTime(new Date(y!, (m ?? 1) - 1, 15), { month: 'short', year: '2-digit' });
  };
  const csvHref = `/api/backend/reports/trips.csv?from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`;

  const tiles = data
    ? [
        { label: t('web.reports.trips'), value: format.number(data.totals.trips) },
        { label: t('web.reports.revenue'), value: money(data.totals.revenue) },
        { label: t('web.reports.expenses'), value: money(data.totals.expenses) },
        { label: t('web.reports.profit'), value: money(data.totals.profit), strong: true },
        { label: t('web.reports.margin'), value: pct(data.totals.marginPct) },
        { label: t('web.reports.revenuePerKm'), value: `${money(data.totals.revenuePerKm)}/km` },
      ]
    : [];

  return (
    <>
      <PageHeader
        title={t('web.reports.title')}
        subtitle={t('web.reports.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Select aria-label={t('web.reports.range')} value={rangeKey} onChange={(e) => setRangeKey(e.target.value as RangeKey)}>
              {(Object.keys(RANGES) as RangeKey[]).map((k) => (
                <option key={k} value={k}>
                  {t(`web.reports.${k}`)}
                </option>
              ))}
            </Select>
            <Select aria-label={t('web.reports.groupBy')} value={groupBy} onChange={(e) => setGroupBy(e.target.value as ReportGroup)}>
              {REPORT_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {t(`web.reports.group.${g}`)}
                </option>
              ))}
            </Select>
            <a
              href={csvHref}
              className="inline-flex items-center rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-surface-raised"
            >
              {t('web.reports.exportCsv')}
            </a>
          </div>
        }
      />
      {isError && <ErrorState message={t('common.loadError')} />}

      <div className={`grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6 ${isFetching ? 'opacity-60' : ''}`}>
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <p className="text-xs text-muted">{tile.label}</p>
            <p className={`mt-2 text-xl font-bold ${tile.strong ? 'text-primary' : ''}`}>{tile.value}</p>
          </Card>
        ))}
      </div>

      {data && data.totals.trips === 0 ? (
        <Card className="mt-6 text-sm text-muted">{t('web.reports.empty')}</Card>
      ) : (
        data && (
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            {groupBy === 'month' && (
              <Card>
                <h2 className="mb-3 font-semibold">{t('web.reports.profitByMonth')}</h2>
                <BarChart
                  title={t('web.reports.profitByMonth')}
                  data={data.groups.map((g) => ({ key: g.key, label: monthLabel(g.key), value: g.profit }))}
                  format={(v) => formatMoney(v, data.currency, intlLocale)}
                />
              </Card>
            )}
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b border-border text-xs text-muted">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">{t(`web.reports.group.${groupBy}`)}</th>
                    <th className="px-4 py-3 text-end font-medium">{t('web.reports.trips')}</th>
                    <th className="px-4 py-3 text-end font-medium">{t('web.reports.revenue')}</th>
                    <th className="px-4 py-3 text-end font-medium">{t('web.reports.profit')}</th>
                    <th className="px-4 py-3 text-end font-medium">{t('web.reports.margin')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((g) => (
                    <tr key={g.key} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2">{groupBy === 'month' ? monthLabel(g.key) : g.label}</td>
                      <td className="px-4 py-2 text-end">{g.trips}</td>
                      <td className="px-4 py-2 text-end">{money(g.revenue)}</td>
                      <td className="px-4 py-2 text-end font-semibold">{money(g.profit)}</td>
                      <td className="px-4 py-2 text-end">{pct(g.marginPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )
      )}
      {data && <p className="mt-2 text-xs text-muted">{t('web.reports.currencyNote', { currency: data.currency })}</p>}

      <h2 className="mt-10 mb-4 text-lg font-bold">{t('web.reports.aiTitle')}</h2>
      {ai && ai.negotiations === 0 ? (
        <Card className="text-sm text-muted">{t('web.reports.aiEmpty')}</Card>
      ) : (
        ai && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[
                { label: t('web.reports.negotiations'), value: format.number(ai.negotiations) },
                { label: t('web.reports.closeRate'), value: pct(ai.closeRatePct) },
                { label: t('web.reports.avgUplift'), value: pct(ai.avgUpliftPct), strong: true },
                { label: t('web.reports.totalUplift'), value: money(ai.totalUplift), strong: true },
                { label: t('web.reports.avgRounds'), value: format.number(ai.avgRounds, { maximumFractionDigits: 1 }) },
              ].map((tile) => (
                <Card key={tile.label}>
                  <p className="text-xs text-muted">{tile.label}</p>
                  <p className={`mt-2 text-xl font-bold ${tile.strong ? 'text-primary' : ''}`}>{tile.value}</p>
                </Card>
              ))}
            </div>
            {ai.byStrategy.length > 0 && (
              <Card className="mt-4 overflow-x-auto p-0">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="border-b border-border text-xs text-muted">
                    <tr>
                      <th className="px-4 py-3 text-start font-medium">{t('web.reports.byStrategy')}</th>
                      <th className="px-4 py-3 text-end font-medium">{t('web.reports.negotiations')}</th>
                      <th className="px-4 py-3 text-end font-medium">{t('web.reports.booked')}</th>
                      <th className="px-4 py-3 text-end font-medium">{t('web.reports.avgUplift')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ai.byStrategy.map((s) => (
                      <tr key={s.strategy} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2">{t(`domain.strategy.${s.strategy}`)}</td>
                        <td className="px-4 py-2 text-end">{s.negotiations}</td>
                        <td className="px-4 py-2 text-end">{s.booked}</td>
                        <td className="px-4 py-2 text-end">{pct(s.avgUpliftPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )
      )}
    </>
  );
}
