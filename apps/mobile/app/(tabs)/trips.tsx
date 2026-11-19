import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFormatter, useTranslations } from 'use-intl';
import { formatMoney, type TripDto } from '@dispatcher/shared';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useColors } from '@/lib/theme';
import { useIntlLocale } from '@/lib/use-intl-locale';
import { useGetTripsQuery } from '@/store/api';

type Filter = 'active' | 'completed';

function TripRow({ trip }: { trip: TripDto }) {
  const t = useTranslations();
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const router = useRouter();
  const done = trip.status === 'completed';
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/trips/[id]', params: { id: trip.id } })}>
      <Card className={`mb-3 ${trip.status === 'in_transit' ? 'border-primary' : ''}`}>
        <View className="flex-row items-center justify-between">
          <Text className="font-sans-bold text-sm text-muted">#{trip.code}</Text>
          <Badge label={t(`domain.tripStatus.${trip.status}`)} tone={done ? 'neutral' : 'primary'} />
        </View>
        <Text className="mt-1 font-sans-bold text-base text-ink" numberOfLines={1}>
          {trip.load.originCity}, {trip.load.originProvince} → {trip.load.destinationCity}, {trip.load.destinationProvince}
        </Text>
        <View className="mt-2 flex-row items-end justify-between">
          <Text className="font-sans text-xs text-muted">
            {trip.etaAt && !done
              ? `${t('trip.eta')}: ${format.dateTime(new Date(trip.etaAt), { hour: 'numeric', minute: '2-digit' })}`
              : format.dateTime(new Date(trip.load.pickupAt), { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
          <Text className="font-sans-bold text-lg text-primary">
            {formatMoney(done ? trip.financials.actualProfit : trip.financials.rate, trip.financials.currency, intlLocale)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

export default function TripsScreen() {
  const t = useTranslations();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('active');
  const { data, isLoading, isError, isFetching, refetch } = useGetTripsQuery({ filter });

  return (
    <View className="flex-1 bg-background px-5" style={{ paddingTop: insets.top + 12 }}>
      <ScreenHeader title={t('mobile.tabs.trips')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 grow-0" contentContainerStyle={{ gap: 8 }}>
        {(['active', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)}
            className={`rounded-full border px-4 py-2 ${filter === f ? 'border-primary bg-primary' : 'border-border bg-surface'}`}
          >
            <Text className={`font-sans-semibold text-sm ${filter === f ? 'text-on-primary' : 'text-ink'}`}>
              {f === 'active' ? t('trip.filterActive') : t('trip.filterCompleted')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : isError ? (
        <Card>
          <Text className="font-sans text-sm text-danger">{t('common.loadError')}</Text>
        </Card>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(trip) => trip.id}
          renderItem={({ item }) => <TripRow trip={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <Card>
              <Text className="font-sans text-sm text-muted">{t('trip.noTrips')}</Text>
            </Card>
          }
        />
      )}
    </View>
  );
}
