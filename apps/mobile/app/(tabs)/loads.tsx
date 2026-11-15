import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LoadDto } from '@dispatcher/shared';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { LoadCard } from '@/features/loads/LoadCard';
import { useTranslations } from 'use-intl';
import { useColors } from '@/lib/theme';
import { useGetLoadsQuery } from '@/store/api';

export default function LoadsScreen() {
  const t = useTranslations();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, isFetching, refetch } = useGetLoadsQuery({ limit: 50 });

  const renderItem = useCallback(({ item }: { item: LoadDto }) => <LoadCard load={item} />, []);

  return (
    <View className="flex-1 bg-background px-5" style={{ paddingTop: insets.top + 12 }}>
      <ScreenHeader title={t('mobile.loads.title')} />
      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : isError ? (
        <Card>
          <Text className="font-sans text-sm text-danger">{t('mobile.loads.error')}</Text>
        </Card>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={colors.primary} />
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
