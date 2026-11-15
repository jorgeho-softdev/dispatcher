import { memo } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatMoney, type LoadDto } from '@dispatcher/shared';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useColors } from '@/lib/theme';
import { useFormatter, useTranslations } from 'use-intl';
import { useIntlLocale } from '@/lib/use-intl-locale';

// Memoized: rendered inside a FlatList.
export const LoadCard = memo(function LoadCard({ load }: { load: LoadDto }) {
  const colors = useColors();
  const t = useTranslations();
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const pickup = format.dateTime(new Date(load.pickupAt), { weekday: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <Card className="mb-3">
      <View className="flex-row items-center" style={{ gap: 6 }}>
        {load.isSimulated && <Badge label={t('common.demo')} tone="warning" />}
        <Badge label={t(`domain.equipment.${load.equipment}`)} />
      </View>
      <Text className="mt-2 font-sans-bold text-base text-ink" numberOfLines={1}>
        {load.originCity}, {load.originProvince} → {load.destinationCity}, {load.destinationProvince}
      </Text>
      <View className="mt-1 flex-row items-center" style={{ gap: 14 }}>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <Ionicons name="navigate-outline" size={13} color={colors.muted} />
          <Text className="font-sans text-xs text-muted">{format.number(load.distanceKm)} km</Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <Ionicons name="calendar-outline" size={13} color={colors.muted} />
          <Text className="font-sans text-xs text-muted">{pickup}</Text>
        </View>
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
  );
});
