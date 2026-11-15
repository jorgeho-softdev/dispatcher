import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import type { LatLng, LoadDto, LoadView } from '@dispatcher/shared';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadCard } from '@/features/loads/LoadCard';
import { LoadViewTabs } from '@/features/loads/LoadViewTabs';
import { useColors } from '@/lib/theme';
import { getCurrentPosition } from '@/lib/location';
import { useGetLoadPagesInfiniteQuery, useReportVehicleLocationMutation } from '@/store/api';

const PAGE_SIZE = 20;

export default function LoadsScreen() {
  const t = useTranslations();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<LoadView>('recommended');
  // Phone GPS, only after the user taps "Use my location" (never on open).
  const [position, setPosition] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [reportLocation] = useReportVehicleLocationMutation();

  const { data, isLoading, isError, isFetching, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useGetLoadPagesInfiniteQuery({ view, limit: PAGE_SIZE, ...(position ?? {}) });
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const context = data?.pages[0]?.context;

  const useMyLocation = async () => {
    setLocating(true);
    const result = await getCurrentPosition();
    setLocating(false);
    if (result.status !== 'granted') return;
    setPosition(result.position);
    // Keep the vehicle's last known position fresh for deadhead everywhere.
    if (context?.vehicle) void reportLocation({ id: context.vehicle.id, ...result.position });
  };

  const renderItem = useCallback(({ item }: { item: LoadDto }) => <LoadCard load={item} />, []);
  const needsLocation = view === 'nearby' && context && !context.positionSource;

  return (
    <View className="flex-1 bg-background px-5" style={{ paddingTop: insets.top + 12 }}>
      <ScreenHeader title={t('mobile.loads.title')} />
      <LoadViewTabs value={view} onChange={setView} />

      {context && !context.vehicle && (
        <Card className="mb-3">
          <Text className="font-sans text-sm text-muted">{t('mobile.loads.noVehicle')}</Text>
        </Card>
      )}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : isError ? (
        <Card>
          <Text className="font-sans text-sm text-danger">{t('mobile.loads.error')}</Text>
        </Card>
      ) : needsLocation ? (
        <Card>
          <Text className="font-sans text-sm text-muted">{t('mobile.loads.nearbyNeedsLocation')}</Text>
          <Button className="mt-4" title={t('mobile.loads.enableLocation')} loading={locating} onPress={useMyLocation} />
        </Card>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          ListHeaderComponent={
            view === 'nearby' && !position ? (
              <Button
                className="mb-3"
                variant="secondary"
                title={t('mobile.loads.enableLocation')}
                loading={locating}
                onPress={useMyLocation}
              />
            ) : null
          }
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading && !isFetchingNextPage} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <Card>
              <Text className="font-sans text-sm text-muted">{t('mobile.loads.empty')}</Text>
            </Card>
          }
        />
      )}
    </View>
  );
}
