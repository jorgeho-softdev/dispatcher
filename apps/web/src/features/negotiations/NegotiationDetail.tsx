'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { MAX_NEGOTIATION_ROUNDS, TERMINAL_STATUSES, can, formatMoney, toErrorCode } from '@dispatcher/shared';
import { Link } from '@/i18n/navigation';
import { useIntlLocale } from '@/i18n/use-intl-locale';
import {
  useApproveBookingMutation,
  useApproveSendMutation,
  useCancelNegotiationMutation,
  useGetMeQuery,
  useGetNegotiationQuery,
} from '@/lib/store/api';
import { Badge, Button, Card, ErrorState, PageHeader } from '@/components/ui';
import { useState } from 'react';

const ACTOR_DOT: Record<string, string> = { ai: 'bg-primary', user: 'bg-info', broker: 'bg-warning', system: 'bg-muted' };

/** Negotiation detail with the full AI audit trail (who decided what, why, with which strategy). */
export function NegotiationDetail({ id }: { id: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const { data: me } = useGetMeQuery();
  const { data: n, isError, isLoading } = useGetNegotiationQuery(id, { pollingInterval: 3000 });
  const [approveSend, sendState] = useApproveSendMutation();
  const [approveBooking, bookState] = useApproveBookingMutation();
  const [cancel, cancelState] = useCancelNegotiationMutation();
  const [error, setError] = useState<string | null>(null);

  if (isError) return <ErrorState message={t('common.loadError')} />;
  if (isLoading || !n) return <p className="text-sm text-muted">{t('common.loading')}</p>;

  const money = (v: number) => formatMoney(v, n.currency, intlLocale);
  const canBook = can(me?.role, 'loads:book');
  const run = async (p: Promise<{ error?: unknown }>) => {
    setError(null);
    const r = await p;
    if (r.error) setError(t(`errors.${toErrorCode((r.error as { data?: { code?: unknown } }).data?.code)}`));
  };
  const explain = (e: (typeof n.events)[number]) =>
    e.rationale ?? (e.reasonCode ? t(`domain.aiReason.${e.reasonCode}`, e.reasonParams ?? {}) : null);

  return (
    <>
      <Link href="/negotiations" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        {t('web.negotiations.back')}
      </Link>
      <PageHeader
        title={`${n.load.originCity} → ${n.load.destinationCity}`}
        subtitle={`${t(`domain.equipment.${n.load.equipment}`)} · ${format.number(n.load.distanceKm)} km · ${n.load.brokerName ?? ''}`}
        actions={
          <div className="flex items-center gap-2">
            {n.load.isSimulated && <Badge tone="warning">{t('common.demo')}</Badge>}
            <Badge tone={TERMINAL_STATUSES.includes(n.status) ? 'neutral' : 'primary'}>
              {t(`domain.negotiationStatus.${n.status}`)}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <h2 className="mb-4 font-semibold">{t('web.negotiations.audit')}</h2>
          <ol className="space-y-4">
            {n.events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${ACTOR_DOT[e.actor]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {t(`domain.negotiationEvent.${e.type}`)}
                      {e.amount !== null && <span className="text-primary"> · {money(e.amount)}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {t(`domain.actor.${e.actor}`)} ·{' '}
                      {format.dateTime(new Date(e.createdAt), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                  {explain(e) && <p className="mt-0.5 text-sm text-muted">{explain(e)}</p>}
                  {e.brokerMessage && (
                    <p className="mt-1 text-xs italic text-muted">
                      {e.actor === 'broker' ? t('negotiation.brokerMessage') : t('negotiation.messageToBroker')}: “
                      {e.brokerMessage}”
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-2 text-sm">
            <Row label={t('negotiation.postedRate')} value={money(n.postedRate)} />
            {n.currentOffer !== null && <Row label={t('negotiation.myOffer')} value={money(n.currentOffer)} />}
            {n.brokerOffer !== null && <Row label={t('negotiation.brokerOffer')} value={money(n.brokerOffer)} />}
            {n.agreedRate !== null && <Row label={t('negotiation.agreedRate')} value={money(n.agreedRate)} strong />}
            <Row label={t('negotiation.estProfit')} value={money(n.estimatedProfit)} strong />
            <Row
              label={t('negotiation.margin')}
              value={format.number(n.marginPct / 100, { style: 'percent', maximumFractionDigits: 1 })}
            />
            <p className="pt-2 text-xs text-muted">
              {t('negotiation.limits', { floor: money(n.floorRate), ceiling: money(n.ceilingRate) })}
              <br />
              {t('negotiation.round', { round: n.round, max: MAX_NEGOTIATION_ROUNDS })} ·{' '}
              {t('negotiation.proposedBy', { strategy: t(`domain.strategy.${n.strategy}`) })} ·{' '}
              {t(`domain.autonomy.${n.autonomyLevel}`)}
            </p>
          </Card>

          {canBook && n.allowedActions.length > 0 && (
            <Card className="space-y-3">
              {n.allowedActions.includes('approve_send') && (
                <Button className="w-full" disabled={sendState.isLoading} onClick={() => run(approveSend(n.id))}>
                  {t('negotiation.approveSend')}
                </Button>
              )}
              {n.allowedActions.includes('approve_booking') && (
                <Button className="w-full" disabled={bookState.isLoading} onClick={() => run(approveBooking(n.id))}>
                  {t('negotiation.approveBooking')}
                </Button>
              )}
              {n.allowedActions.includes('cancel') && (
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={cancelState.isLoading}
                  onClick={() => {
                    if (window.confirm(t('negotiation.cancelConfirm'))) void run(cancel(n.id));
                  }}
                >
                  {t('negotiation.cancel')}
                </Button>
              )}
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </Card>
          )}
          {n.load.isSimulated && <p className="text-xs text-muted">{t('negotiation.simulatedBroker')}</p>}
        </div>
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
