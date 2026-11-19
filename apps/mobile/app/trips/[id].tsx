import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFormatter, useTranslations } from 'use-intl';
import {
  EXPENSE_CATEGORIES,
  can,
  formatMoney,
  toErrorCode,
  type ExpenseCategory,
  type TripDetailDto,
} from '@dispatcher/shared';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ChoicePills } from '@/components/ui/ChoicePills';
import { TripStepper } from '@/features/trips/TripStepper';
import { TripMap } from '@/features/trips/TripMap';
import { useTripTracking } from '@/features/trips/useTripTracking';
import { useDocumentUpload } from '@/features/trips/useDocumentUpload';
import { appAlert } from '@/lib/app-alert';
import { useColors } from '@/lib/theme';
import { useIntlLocale } from '@/lib/use-intl-locale';
import { useAppSelector } from '@/store/hooks';
import { selectMe } from '@/store/auth-slice';
import {
  useAddTripExpenseMutation,
  useCompleteTripMutation,
  useGetDocumentDownloadUrlMutation,
  useGetTripQuery,
  useRateBrokerMutation,
  useUpdateTripStatusMutation,
} from '@/store/api';

/** Opens turn-by-turn navigation in the phone's maps app. */
function navigateTo(lat: number, lng: number) {
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
      : `google.navigation:q=${lat},${lng}&mode=d`;
  void Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`),
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'primary' | 'danger' }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="font-sans text-sm text-muted">{label}</Text>
      <Text
        className={`font-sans-bold text-base ${tone === 'primary' ? 'text-primary' : tone === 'danger' ? 'text-danger' : 'text-ink'}`}
      >
        {value}
      </Text>
    </View>
  );
}

/** Trip in progress (mockup screen 4) and close-out (mockup screen 5). */
export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const colors = useColors();
  const router = useRouter();
  const me = useAppSelector(selectMe);
  const { data: trip, isLoading, isError } = useGetTripQuery(id, { pollingInterval: 30_000, skipPollingIfUnfocused: true });
  const tracking = useTripTracking(id, trip?.status);
  const { upload, uploading } = useDocumentUpload(id);
  const [updateStatus, statusState] = useUpdateTripStatusMutation();
  const [completeTrip, completeState] = useCompleteTripMutation();
  const [addExpense, expenseState] = useAddTripExpenseMutation();
  const [rateBroker] = useRateBrokerMutation();
  const [getDownloadUrl] = useGetDocumentDownloadUrlMutation();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>('fuel');
  const [amount, setAmount] = useState('');

  const fail = (error: unknown) =>
    appAlert(t(`errors.${toErrorCode((error as { data?: { code?: unknown } } | undefined)?.data?.code)}`));

  if (isLoading || isError || !trip) {
    return (
      <Screen>
        <ScreenHeader title={t('mobile.tabs.trips')} showBack showSettings={false} />
        {isLoading ? (
          <ActivityIndicator color={colors.primary} className="mt-10" />
        ) : (
          <Card>
            <Text className="font-sans text-sm text-danger">{t('common.loadError')}</Text>
          </Card>
        )}
      </Screen>
    );
  }

  const money = (v: number) => formatMoney(v, trip.financials.currency, intlLocale);
  const manage = can(me?.role, 'trips:manage');
  const target = trip.status === 'in_transit' || trip.status === 'delivered'
    ? { lat: trip.load.destinationLat, lng: trip.load.destinationLng }
    : { lat: trip.load.originLat, lng: trip.load.originLng };

  const advance = () => {
    const next = trip.nextStatus;
    if (next !== 'at_pickup' && next !== 'in_transit' && next !== 'delivered') return;
    const go = async () => {
      const r = await updateStatus({ id: trip.id, status: next });
      if (r.error) fail(r.error);
    };
    if (next === 'delivered') {
      appAlert(t('trip.confirmDelivered'), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('trip.next.delivered'), onPress: () => void go() },
      ]);
    } else void go();
  };

  const pickDocument = (type: 'pod' | 'bol' | 'receipt') =>
    appAlert(t('trip.uploadDocument'), t(`domain.documentType.${type}`), [
      { text: t('trip.takePhoto'), onPress: () => void runUpload(type, 'camera') },
      { text: t('trip.chooseFromLibrary'), onPress: () => void runUpload(type, 'library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  const runUpload = async (type: 'pod' | 'bol' | 'receipt', source: 'camera' | 'library') => {
    const result = await upload(type, source);
    if (result === 'denied') appAlert(t('trip.cameraDenied'));
    if (result === 'failed') appAlert(t('errors.UPLOAD_NOT_FOUND'));
  };
  const openDocument = async (docId: string) => {
    const r = await getDownloadUrl(docId);
    if (r.data) void Linking.openURL(r.data.url);
    else fail(r.error);
  };

  return (
    <Screen>
      <ScreenHeader title={t('trip.title', { code: trip.code })} showBack showSettings={false} />
      <Text className="-mt-3 mb-4 text-center font-sans-semibold text-sm text-muted">
        {trip.load.originCity}, {trip.load.originProvince} → {trip.load.destinationCity}, {trip.load.destinationProvince}
        {trip.load.isSimulated ? `  ·  ${t('common.demo')}` : ''}
      </Text>

      {trip.status === 'completed' ? (
        <CompletedView trip={trip} money={money} onRate={(stars) => void rateBroker({ id: trip.id, stars })} onNext={() => router.navigate('/loads')} onOpenDoc={openDocument} />
      ) : (
        <>
          <TripStepper status={trip.status} />
          <View className="mt-4 overflow-hidden rounded-card">
            <TripMap trip={trip} />
          </View>

          <View className="mt-3 flex-row" style={{ gap: 10 }}>
            <Card className="flex-1">
              <Text className="font-sans text-xs text-muted">{t('trip.eta')}</Text>
              <Text className="font-sans-bold text-xl text-ink">
                {trip.etaAt ? format.dateTime(new Date(trip.etaAt), { hour: 'numeric', minute: '2-digit' }) : '—'}
              </Text>
            </Card>
            <Card className="flex-1">
              <Text className="font-sans text-xs text-muted">{t('trip.remaining')}</Text>
              <Text className="font-sans-bold text-xl text-ink">
                {trip.remainingKm !== null ? `${format.number(Math.round(trip.remainingKm))} km` : '—'}
              </Text>
            </Card>
          </View>
          <Text className="mt-2 font-sans text-[11px] text-muted-light">
            {tracking === 'tracking' ? t('trip.tracking') : tracking === 'denied' ? t('trip.trackingOff') : ''}
          </Text>

          {trip.nextStatus && trip.status !== 'delivered' && (
            <Button className="mt-4" title={t(`trip.next.${trip.nextStatus as 'at_pickup' | 'in_transit' | 'delivered'}`)} loading={statusState.isLoading} onPress={advance} />
          )}

          <View className="mt-3 flex-row" style={{ gap: 10 }}>
            <Button className="flex-1" title={t('trip.navigate')} onPress={() => navigateTo(target.lat, target.lng)} />
            <Button
              className="flex-1"
              variant="secondary"
              title={t('trip.callBroker')}
              disabled={!trip.load.brokerPhone}
              onPress={() => trip.load.brokerPhone && void Linking.openURL(`tel:${trip.load.brokerPhone}`)}
            />
          </View>
          {!trip.load.brokerPhone && <Text className="mt-1 text-center font-sans text-[11px] text-muted-light">{t('trip.noBrokerPhone')}</Text>}

          {trip.status === 'delivered' && (
            <Card className="mt-4 border-primary">
              <Text className="font-sans text-sm text-ink">{trip.hasPod ? t('trip.podDone') : t('trip.podMissing')}</Text>
              {!trip.hasPod && <Button className="mt-3" title={t('trip.uploadPod')} loading={uploading} onPress={() => pickDocument('pod')} />}
              {trip.hasPod && manage && (
                <Button
                  className="mt-3"
                  title={t('trip.closeTrip')}
                  loading={completeState.isLoading}
                  onPress={async () => {
                    const r = await completeTrip(trip.id);
                    if (r.error) fail(r.error);
                  }}
                />
              )}
            </Card>
          )}

          <SectionTitle title={t('trip.documents')} />
          <Card padded={false}>
            {trip.documents.map((d) => (
              <TouchableOpacity key={d.id} onPress={() => void openDocument(d.id)} className="flex-row items-center border-b border-border px-4 py-3">
                <Ionicons name="document-text-outline" size={18} color={colors.muted} />
                <Text className="ms-3 flex-1 font-sans text-sm text-ink">{t(`domain.documentType.${d.type}`)}</Text>
                <Text className="font-sans-semibold text-xs text-primary">{t('trip.open')}</Text>
              </TouchableOpacity>
            ))}
            <View className="flex-row px-4 py-3" style={{ gap: 8 }}>
              {(['pod', 'bol', 'receipt'] as const).map((type) => (
                <TouchableOpacity key={type} onPress={() => pickDocument(type)} disabled={uploading} className="rounded-full border border-border px-3 py-1.5">
                  <Text className="font-sans-semibold text-xs text-ink">+ {type.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
              {uploading && <ActivityIndicator color={colors.primary} />}
            </View>
          </Card>

          <SectionTitle title={t('trip.expenses')} />
          <Card>
            {trip.expenses.length === 0 && <Text className="font-sans text-sm text-muted">{t('trip.noExpenses')}</Text>}
            {trip.expenses.map((e) => (
              <Row key={e.id} label={t(`domain.expenseCategory.${e.category}`)} value={money(e.amount)} />
            ))}
            {expenseOpen ? (
              <View className="mt-3">
                <ChoicePills
                  options={EXPENSE_CATEGORIES.map((c) => ({ key: c, label: t(`domain.expenseCategory.${c}`) }))}
                  value={category}
                  onChange={setCategory}
                />
                <TextField className="mt-3" label={t('trip.amount', { currency: trip.financials.currency })} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
                <Button
                  className="mt-3"
                  title={t('trip.saveExpense')}
                  loading={expenseState.isLoading}
                  disabled={!(Number(amount) > 0)}
                  onPress={async () => {
                    const r = await addExpense({ id: trip.id, category, amount: Number(amount) });
                    if (r.error) return fail(r.error);
                    setAmount('');
                    setExpenseOpen(false);
                  }}
                />
              </View>
            ) : (
              <Button className="mt-3" variant="secondary" title={t('trip.addExpense')} onPress={() => setExpenseOpen(true)} />
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

/** Mockup screen 5: "¡Entrega completada!" with the real profit. */
function CompletedView({
  trip,
  money,
  onRate,
  onNext,
  onOpenDoc,
}: {
  trip: TripDetailDto;
  money: (v: number) => string;
  onRate: (stars: number) => void;
  onNext: () => void;
  onOpenDoc: (id: string) => Promise<void>;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const colors = useColors();
  const f = trip.financials;
  const rc = trip.documents.find((d) => d.type === 'rate_confirmation');

  return (
    <>
      <View className="items-center">
        <View className="h-20 w-20 items-center justify-center rounded-full border-4 border-primary">
          <Ionicons name="checkmark" size={44} color={colors.primary} />
        </View>
        <Text className="mt-3 font-sans-bold text-2xl text-ink">{t('trip.completedTitle')}</Text>
        <Text className="mt-1 text-center font-sans text-sm text-muted">{t('trip.completedBody')}</Text>
      </View>

      <Card className="mt-5">
        <Row label={t('trip.finalRate')} value={money(f.rate)} />
        <Row label={t('trip.actualExpenses')} value={`− ${money(f.actualExpenses)}`} />
        <View className="my-1 rounded-xl bg-primary-light px-3">
          <Row label={t('trip.actualProfit')} value={money(f.actualProfit)} tone="primary" />
        </View>
        <Row label={t('trip.finalMargin')} value={format.number(f.actualMarginPct / 100, { style: 'percent', maximumFractionDigits: 1 })} tone="primary" />
        <Text className="mt-1 font-sans text-[11px] text-muted-light">
          {t('trip.estimatedProfit')}: {money(f.estimatedProfit)}
        </Text>
      </Card>

      <Card className="mt-3">
        <View className="flex-row items-center justify-between py-1.5">
          <Text className="font-sans text-sm text-ink">{t('trip.podDone')}</Text>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        </View>
        <View className="flex-row items-center justify-between py-1.5">
          <Text className="font-sans text-sm text-ink">{t('trip.docsComplete')}</Text>
          <Ionicons name={rc ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={rc ? colors.primary : colors.mutedLight} />
        </View>
        <View className="flex-row items-center justify-between py-1.5">
          <Text className="font-sans text-sm text-ink">{t('trip.rateBroker')}</Text>
          <View className="flex-row" style={{ gap: 4 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity
                key={s}
                accessibilityLabel={t('trip.starsLabel', { stars: s })}
                disabled={trip.brokerRating !== null}
                onPress={() => onRate(s)}
              >
                <Ionicons name={(trip.brokerRating?.stars ?? 0) >= s ? 'star' : 'star-outline'} size={22} color={colors.warning} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {trip.brokerRating && trip.load.brokerName && (
          <Text className="font-sans text-xs text-muted">{t('trip.ratedThanks', { broker: trip.load.brokerName })}</Text>
        )}
      </Card>

      {rc && <Button className="mt-5" variant="secondary" title={t('domain.documentType.rate_confirmation')} onPress={() => void onOpenDoc(rc.id)} />}
      <Button className="mt-3" title={t('trip.findNextLoad')} onPress={onNext} />
    </>
  );
}
