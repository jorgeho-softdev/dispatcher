import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFormatter, useTranslations } from 'use-intl';
import {
  MAX_NEGOTIATION_ROUNDS,
  TERMINAL_STATUSES,
  formatMoney,
  toErrorCode,
  type NegotiationDetailDto,
  type NegotiationStatus,
} from '@dispatcher/shared';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Timeline } from '@/features/negotiation/Timeline';
import { useExplain } from '@/features/negotiation/useExplain';
import { appAlert } from '@/lib/app-alert';
import { useColors } from '@/lib/theme';
import { useIntlLocale } from '@/lib/use-intl-locale';
import {
  dispatcherApi,
  useAdjustOfferMutation,
  useApproveBookingMutation,
  useApproveSendMutation,
  useCancelNegotiationMutation,
  useGetNegotiationQuery,
} from '@/store/api';

const WORKING: NegotiationStatus[] = ['ai_thinking', 'contacting_broker', 'booking_requested'];

/** Checklist from the mockup, derived from the negotiation status. */
function steps(n: NegotiationDetailDto) {
  const after = (s: NegotiationStatus[]) => s.includes(n.status);
  return [
    { key: 'stepContact', done: n.agreedRate !== null, active: after(['ai_thinking', 'awaiting_send_approval', 'contacting_broker']) },
    { key: 'stepConfirmRate', done: after(['booking_requested', 'booked']), active: n.status === 'awaiting_booking_approval' },
    { key: 'stepBook', done: n.status === 'booked', active: n.status === 'booking_requested' },
    { key: 'stepRateConfirmation', done: false, active: false },
  ] as const;
}

/** "Negotiate & book" (mockup screen 3), driven by the AI workflow in the api. */
export default function NegotiationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const colors = useColors();
  const explain = useExplain();
  const router = useRouter();
  const [adjusting, setAdjusting] = useState(false);
  const [amount, setAmount] = useState('');

  // Poll only while the AI or the broker is working; push covers long waits.
  const cachedStatus = dispatcherApi.endpoints.getNegotiation.useQueryState(id).data?.status;
  const { data: n, isLoading, isError } = useGetNegotiationQuery(id, {
    pollingInterval: !cachedStatus || WORKING.includes(cachedStatus) ? 2000 : 0,
    skipPollingIfUnfocused: true,
  });
  const [approveSend, sendState] = useApproveSendMutation();
  const [adjustOffer, adjustState] = useAdjustOfferMutation();
  const [approveBooking, bookState] = useApproveBookingMutation();
  const [cancel] = useCancelNegotiationMutation();

  const money = (v: number) => formatMoney(v, n?.currency ?? 'CAD', intlLocale);
  const fail = (error: unknown) => {
    const code = toErrorCode((error as { data?: { code?: unknown } } | undefined)?.data?.code);
    appAlert(t(`errors.${code}`));
  };
  const run = async (p: Promise<{ error?: unknown }>) => {
    const r = await p;
    if (r.error) fail(r.error);
  };

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t('negotiation.title')} showBack showSettings={false} />
        <ActivityIndicator color={colors.primary} className="mt-10" />
      </Screen>
    );
  }
  if (isError || !n) {
    return (
      <Screen>
        <ScreenHeader title={t('negotiation.title')} showBack showSettings={false} />
        <Card>
          <Text className="font-sans text-sm text-danger">{t('common.loadError')}</Text>
        </Card>
      </Screen>
    );
  }

  const working = WORKING.includes(n.status);
  const terminal = TERMINAL_STATUSES.includes(n.status);
  const shownOffer = n.agreedRate ?? n.currentOffer;
  const aiText = n.status === 'ai_thinking' ? t('negotiation.aiThinking') : explain(n.latestAi);

  return (
    <Screen>
      <ScreenHeader title={t('negotiation.title')} showBack showSettings={false} />

      {/* Load summary */}
      <Card>
        <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
          <Badge label={t(`domain.negotiationStatus.${n.status}`)} tone={terminal ? 'neutral' : 'primary'} />
          {n.load.isSimulated && <Badge label={t('common.demo')} tone="warning" />}
        </View>
        <Text className="mt-2 font-sans-bold text-lg text-ink">
          {n.load.originCity}, {n.load.originProvince} → {n.load.destinationCity}, {n.load.destinationProvince}
        </Text>
        <Text className="font-sans text-xs text-muted">
          {format.number(n.load.distanceKm)} km · {t(`domain.equipment.${n.load.equipment}`)} ·{' '}
          {format.number(n.load.weightKg)} kg ·{' '}
          {format.dateTime(new Date(n.load.pickupAt), { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
        </Text>
      </Card>

      {/* AI card */}
      <Card className="mt-3 border-primary">
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary-light">
            {working && n.status === 'ai_thinking' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="hardware-chip-outline" size={24} color={colors.primary} />
            )}
          </View>
          <View className="flex-1">
            <Text className="font-sans-bold text-base text-ink">{t('negotiation.aiCardTitle')}</Text>
            <Text className="font-sans text-xs text-muted">
              {n.status === 'contacting_broker' ? t('negotiation.waitingBroker') : aiText}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row items-center" style={{ gap: 10 }}>
          <View className="flex-1 rounded-xl border border-border p-3">
            <Text className="font-sans text-[11px] text-muted">{t('negotiation.postedRate')}</Text>
            <Text className="font-sans-bold text-xl text-ink">{money(n.postedRate)}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.muted} />
          <View className="flex-1 rounded-xl border border-primary bg-primary-light p-3">
            <Text className="font-sans text-[11px] text-primary">
              {n.agreedRate !== null ? t('negotiation.agreedRate') : t('negotiation.myOffer')}
            </Text>
            <Text className="font-sans-bold text-xl text-primary">{shownOffer !== null ? money(shownOffer) : '…'}</Text>
          </View>
        </View>

        <View className="mt-3 flex-row" style={{ gap: 10 }}>
          <View className="flex-1">
            <Text className="font-sans text-[11px] text-muted">{t('negotiation.estProfit')}</Text>
            <Text className="font-sans-bold text-lg text-primary">{money(n.estimatedProfit)}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-sans text-[11px] text-muted">{t('negotiation.margin')}</Text>
            <Text className="font-sans-bold text-lg text-primary">
              {format.number(n.marginPct / 100, { style: 'percent', maximumFractionDigits: 0 })}
            </Text>
          </View>
          {n.brokerOffer !== null && n.agreedRate === null && (
            <View className="flex-1">
              <Text className="font-sans text-[11px] text-muted">{t('negotiation.brokerOffer')}</Text>
              <Text className="font-sans-bold text-lg text-ink">{money(n.brokerOffer)}</Text>
            </View>
          )}
        </View>
        <Text className="mt-3 font-sans text-[11px] text-muted-light">
          {t('negotiation.limits', { floor: money(n.floorRate), ceiling: money(n.ceilingRate) })} ·{' '}
          {t('negotiation.round', { round: n.round, max: MAX_NEGOTIATION_ROUNDS })} ·{' '}
          {t('negotiation.proposedBy', { strategy: t(`domain.strategy.${n.strategy}`) })}
        </Text>
      </Card>

      {/* Checklist */}
      <Card className="mt-3">
        {steps(n).map((s) => (
          <View key={s.key} className="flex-row items-center py-1.5" style={{ gap: 10 }}>
            <Ionicons
              name={s.done ? 'checkmark-circle' : s.active ? 'ellipse' : 'ellipse-outline'}
              size={20}
              color={s.done || s.active ? colors.primary : colors.mutedLight}
            />
            <Text className={`font-sans text-sm ${s.done || s.active ? 'text-ink' : 'text-muted'}`}>
              {t(`negotiation.${s.key}`)}
            </Text>
          </View>
        ))}
      </Card>

      {n.status === 'booked' && n.agreedRate !== null && (
        <Card className="mt-3 border-success">
          <Text className="font-sans-bold text-base text-success">{t('negotiation.bookedTitle')}</Text>
          <Text className="mt-1 font-sans text-sm text-muted">{t('negotiation.bookedBody', { amount: money(n.agreedRate) })}</Text>
          {n.tripId && (
            <Button
              className="mt-3"
              title={t('trip.viewTrip')}
              onPress={() => router.push({ pathname: '/trips/[id]', params: { id: n.tripId! } })}
            />
          )}
        </Card>
      )}

      {/* Actions (human-in-the-loop) */}
      {n.allowedActions.includes('approve_booking') && (
        <Button
          className="mt-5"
          title={t('negotiation.approveBooking')}
          loading={bookState.isLoading}
          onPress={() => run(approveBooking(n.id))}
        />
      )}
      {n.allowedActions.includes('approve_send') && !adjusting && (
        <Button className="mt-5" title={t('negotiation.approveSend')} loading={sendState.isLoading} onPress={() => run(approveSend(n.id))} />
      )}
      {n.allowedActions.includes('adjust_offer') &&
        (adjusting ? (
          <Card className="mt-3">
            <TextField
              label={t('negotiation.adjustAmount', { currency: n.currency })}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <Text className="mt-2 font-sans text-xs text-muted">
              {t('negotiation.adjustHint', { floor: money(Math.max(n.floorRate, n.postedRate)), ceiling: money(n.ceilingRate) })}
            </Text>
            <Button
              className="mt-3"
              title={t('negotiation.adjustSave')}
              loading={adjustState.isLoading}
              disabled={!(Number(amount) > 0)}
              onPress={async () => {
                await run(adjustOffer({ id: n.id, amount: Number(amount) }));
                setAdjusting(false);
              }}
            />
          </Card>
        ) : (
          <Button
            className="mt-3"
            variant="secondary"
            title={t('negotiation.adjust')}
            onPress={() => {
              setAmount(String(n.currentOffer ?? ''));
              setAdjusting(true);
            }}
          />
        ))}
      {n.allowedActions.includes('cancel') && (
        <Button
          className="mt-3"
          variant="secondary"
          title={t('negotiation.cancel')}
          onPress={() =>
            appAlert(t('negotiation.cancelConfirm'), undefined, [
              { text: t('common.back'), style: 'cancel' },
              { text: t('negotiation.cancel'), style: 'destructive', onPress: () => void run(cancel(n.id)) },
            ])
          }
        />
      )}

      {n.load.isSimulated && (
        <Text className="mt-3 text-center font-sans text-[11px] text-muted-light">{t('negotiation.simulatedBroker')}</Text>
      )}

      <SectionTitle title={t('negotiation.activity')} />
      <Timeline negotiation={n} />
    </Screen>
  );
}
