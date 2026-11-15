'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { TERMINAL_STATUSES, formatMoney, type NegotiationListQuery } from '@dispatcher/shared';
import { Link } from '@/i18n/navigation';
import { useIntlLocale } from '@/i18n/use-intl-locale';
import { useGetNegotiationsQuery } from '@/lib/store/api';
import { Badge, Card, ErrorState, PageHeader } from '@/components/ui';

const FILTERS: { value: NegotiationListQuery['filter']; key: 'filterActive' | 'filterNeedsApproval' | 'filterAll' }[] = [
  { value: 'active', key: 'filterActive' },
  { value: 'needs_approval', key: 'filterNeedsApproval' },
  { value: 'all', key: 'filterAll' },
];

export function NegotiationsList() {
  const t = useTranslations('web.negotiations');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('domain.negotiationStatus');
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const [filter, setFilter] = useState<NegotiationListQuery['filter']>('active');
  const { data, isLoading, isError } = useGetNegotiationsQuery({ filter }, { pollingInterval: 5000 });
  const money = (v: number | null, currency: 'CAD' | 'USD') => (v === null ? '—' : formatMoney(v, currency, intlLocale));

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div role="tablist" className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
              filter === f.value ? 'border-primary bg-primary text-on-primary' : 'border-border text-ink hover:bg-surface-raised'
            }`}
          >
            {t(f.key)}
          </button>
        ))}
      </div>

      {isError ? (
        <ErrorState message={tCommon('loadError')} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-start text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('colRoute')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('colStatus')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('colPosted')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('colOffer')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('colAgreed')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('colUpdated')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    {tCommon('loading')}
                  </td>
                </tr>
              )}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    {t('empty')}
                  </td>
                </tr>
              )}
              {data?.map((n) => (
                <tr key={n.id} className="border-b border-border/60 last:border-0 hover:bg-surface-raised/50">
                  <td className="px-4 py-3">
                    <Link href={`/negotiations/${n.id}`} className="font-semibold hover:text-primary">
                      {n.load.originCity}, {n.load.originProvince} → {n.load.destinationCity}, {n.load.destinationProvince}
                    </Link>
                    {n.load.isSimulated && (
                      <span className="ms-2">
                        <Badge tone="warning">{tCommon('demo')}</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={TERMINAL_STATUSES.includes(n.status) ? 'neutral' : 'primary'}>{tStatus(n.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-end">{money(n.postedRate, n.currency)}</td>
                  <td className="px-4 py-3 text-end">{money(n.currentOffer, n.currency)}</td>
                  <td className="px-4 py-3 text-end font-semibold text-primary">{money(n.agreedRate, n.currency)}</td>
                  <td className="px-4 py-3 text-end text-muted">{format.relativeTime(new Date(n.updatedAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
