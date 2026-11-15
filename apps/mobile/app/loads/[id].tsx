import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFormatter, useTranslations } from 'use-intl';
import { formatMoney } from '@dispatcher/shared';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { MatchBadge } from '@/features/loads/MatchBadge';
import { useColors } from '@/lib/theme';
import { useIntlLocale } from '@/lib/use-intl-locale';
import { useGetLoadQuery } from '@/store/api';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="font-sans text-sm text-muted">{label}</Text>
      <Text className={strong ? 'font-sans-bold text-base text-primary' : 'font-sans-semibold text-sm text-ink'}>
        {value}
      </Text>
    </View>
  );
}

/** Load detail: what the carrier reviews before negotiating (mockup "Negociar y reservar"). */
export default function LoadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const colors = useColors();
  const { data: load, isLoading, isError } = useGetLoadQuery({ id });
  const money = (n: number) => formatMoney(n, load?.currency ?? 'CAD', intlLocale);
  const km = (n: number) => `${format.number(Math.round(n))} km`;

  return (
    <Screen>
      <ScreenHeader title={t('mobile.loadDetail.title')} showBack showSettings={false} />
      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : isError || !load ? (
        <Card>
          <Text className="font-sans text-sm text-danger">{t('common.loadError')}</Text>
        </Card>
      ) : (
        <>
          <Card>
            <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
              <MatchBadge match={load.match} />
              {load.isSimulated && <Badge label={t('common.demo')} tone="warning" />}
            </View>
            <Text className="mt-2 font-sans-bold text-xl text-ink">
              {load.originCity}, {load.originProvince} → {load.destinationCity}, {load.destinationProvince}
            </Text>
            <Row
              label={t('mobile.loadDetail.pickup')}
              value={format.dateTime(new Date(load.pickupAt), {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            />
            <Row label={t('mobile.loadDetail.equipment')} value={t(`domain.equipment.${load.equipment}`)} />
            <Row label={t('mobile.loadDetail.weight')} value={`${format.number(load.weightKg)} kg`} />
            <Row label={t('mobile.loadDetail.broker')} value={load.broker?.name ?? '—'} />
            <Row label={t('mobile.loadDetail.postedRate')} value={money(load.postedRate)} />
            <Row label={t('mobile.loadDetail.ratePerKm')} value={`${money(load.ratePerKm)}/km`} />
          </Card>

          <SectionTitle title={t('mobile.loadDetail.breakdown')} />
          <Card>
            {load.breakdown ? (
              <>
                <Row label={t('mobile.loadDetail.loadedKm')} value={km(load.breakdown.loadedKm)} />
                <Row label={t('mobile.loadDetail.deadheadKm')} value={km(load.breakdown.deadheadKm)} />
                <Row label={t('mobile.loadDetail.costPerKm')} value={`${money(load.breakdown.costPerKm)}/km`} />
                <Row label={t('mobile.loadDetail.costs')} value={`− ${money(load.breakdown.costs)}`} />
                <View className="my-1 h-px bg-border" />
                <Row label={t('mobile.loadDetail.profit')} value={money(load.breakdown.profit)} strong />
                <Row
                  label={t('mobile.loadDetail.margin')}
                  value={format.number(load.breakdown.marginPct / 100, { style: 'percent', maximumFractionDigits: 1 })}
                />
                {load.context.positionSource && (
                  <Text className="mt-2 font-sans text-xs text-muted">
                    {t('mobile.loadDetail.positionFrom', {
                      source: t(`domain.positionSource.${load.context.positionSource}`),
                    })}
                  </Text>
                )}
              </>
            ) : (
              <Text className="font-sans text-sm text-muted">{t('mobile.loadDetail.noBreakdown')}</Text>
            )}
          </Card>

          {load.match && load.match.reasons.length > 0 && (
            <>
              <SectionTitle title={t('mobile.loadDetail.whyMatch')} />
              <Card>
                {load.match.reasons.map((r) => (
                  <View key={r.code} className="flex-row items-center py-1" style={{ gap: 8 }}>
                    <Text className={r.tone === 'positive' ? 'text-success' : 'text-warning'}>
                      {r.tone === 'positive' ? '✓' : '!'}
                    </Text>
                    <Text className="flex-1 font-sans text-sm text-ink">{t(`domain.matchReason.${r.code}`)}</Text>
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* Negotiation arrives with the AI agent (Phase 2). */}
          <Button className="mt-6" title={t('mobile.loadDetail.negotiate')} disabled />
          <Text className="mt-2 text-center font-sans text-xs text-muted">{t('mobile.loadDetail.negotiateSoon')}</Text>
        </>
      )}
    </Screen>
  );
}
