import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFormatter, useTranslations } from 'use-intl';
import { formatMoney, type LoadDto } from '@dispatcher/shared';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useColors } from '@/lib/theme';
import { useIntlLocale } from '@/lib/use-intl-locale';
import { MatchBadge } from './MatchBadge';

// Memoized: rendered inside a FlatList. Tapping opens the load detail.
export const LoadCard = memo(function LoadCard({ load }: { load: LoadDto }) {
  const colors = useColors();
  const t = useTranslations();
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const router = useRouter();
  const pickup = format.dateTime(new Date(load.pickupAt), { weekday: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/loads/[id]', params: { id: load.id } })}
      className="active:opacity-80"
    >
      <Card className={`mb-3 ${(load.match?.score ?? 0) >= 85 ? 'border-primary' : ''}`}>
        <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
          <MatchBadge match={load.match} />
          {load.isSimulated && <Badge label={t('common.demo')} tone="warning" />}
          <Badge label={t(`domain.equipment.${load.equipment}`)} />
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="flex-1 font-sans-bold text-base text-ink" numberOfLines={1}>
            {load.originCity}, {load.originProvince} → {load.destinationCity}, {load.destinationProvince}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
        <View className="mt-1 flex-row flex-wrap items-center" style={{ columnGap: 14, rowGap: 2 }}>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Ionicons name="navigate-outline" size={13} color={colors.muted} />
            <Text className="font-sans text-xs text-muted">{format.number(load.distanceKm)} km</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Ionicons name="calendar-outline" size={13} color={colors.muted} />
            <Text className="font-sans text-xs text-muted">{pickup}</Text>
          </View>
          {load.deadheadKm !== null && (
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Ionicons name="return-down-forward-outline" size={13} color={colors.muted} />
              <Text className="font-sans text-xs text-muted">
                {t('domain.deadhead', { km: format.number(Math.round(load.deadheadKm)) })}
              </Text>
            </View>
          )}
        </View>
        <View className="mt-3 flex-row items-end justify-between">
          <Text className="font-sans-bold text-2xl text-ink">{formatMoney(load.postedRate, load.currency, intlLocale)}</Text>
          <View className="items-end">
            <Text className="font-sans text-[11px] text-muted">{t('mobile.loads.estProfit')}</Text>
            <Text className="font-sans-bold text-lg text-primary">
              {load.estimatedProfit === null ? '—' : formatMoney(load.estimatedProfit, load.currency, intlLocale)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
});
