import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OPPORTUNITY_THRESHOLD, formatMoney } from '@dispatcher/shared';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTranslations } from 'use-intl';
import { useIntlLocale } from '@/lib/use-intl-locale';
import { useColors } from '@/lib/theme';
import { useAppSelector } from '@/store/hooks';
import { selectMe } from '@/store/auth-slice';
import { useGetLoadsQuery } from '@/store/api';
import { LoadCard } from '@/features/loads/LoadCard';
import { SectionTitle } from '@/components/ui/SectionTitle';

export default function HomeScreen() {
  const t = useTranslations();
  const intlLocale = useIntlLocale();
  const colors = useColors();
  const router = useRouter();
  const me = useAppSelector(selectMe);
  // Same ranking as the "Recommended" tab; only strong matches count.
  const { data } = useGetLoadsQuery({ view: 'recommended', limit: 100 });

  const loads = data?.items ?? [];
  const opportunities = loads.filter((l) => (l.match?.score ?? 0) >= OPPORTUNITY_THRESHOLD);
  const best = opportunities[0];
  const bestProfit = Math.max(0, ...opportunities.map((l) => l.estimatedProfit ?? 0));

  const stats = [
    { icon: 'clipboard-outline' as const, value: opportunities.length.toLocaleString(intlLocale), label: t('mobile.home.opportunities', { count: opportunities.length }) },
    { icon: 'bus-outline' as const, value: (0).toLocaleString(intlLocale), label: t('mobile.home.activeTrips') },
    { icon: 'stats-chart' as const, value: formatMoney(bestProfit, 'CAD', intlLocale), label: t('mobile.home.bestProfit') },
  ];

  return (
    <Screen>
      <Text className="font-sans-bold text-3xl text-ink">
        {t('mobile.home.greeting', { name: me?.user.name.split(' ')[0] ?? '' })}
      </Text>
      <Text className="mt-1 font-sans text-sm text-muted">{t('mobile.home.subtitle')}</Text>

      <Card className="mt-6 flex-row items-center border-primary" style={{ gap: 14 }}>
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary-light">
          <Ionicons name="hardware-chip-outline" size={26} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="font-sans-bold text-base text-ink">AI Dispatcher</Text>
          <Text className="font-sans text-xs text-muted">{t('mobile.home.aiAnalyzing')}</Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <View className="h-2 w-2 rounded-full bg-success" />
          <Text className="font-sans-medium text-xs text-ink">{t('mobile.home.aiActive')}</Text>
        </View>
      </Card>

      <View className="mt-4 flex-row" style={{ gap: 10 }}>
        {stats.map((s) => (
          <Card key={s.label} className="flex-1 items-center">
            <Ionicons name={s.icon} size={20} color={colors.ink} />
            <Text className="mt-2 font-sans-bold text-lg text-ink" numberOfLines={1} adjustsFontSizeToFit>
              {s.value}
            </Text>
            <Text className="text-center font-sans text-[11px] text-muted">{s.label}</Text>
          </Card>
        ))}
      </View>

      <Button className="mt-5" title={t('mobile.home.seeLoads')} onPress={() => router.navigate('/loads')} />

      <SectionTitle title={t('mobile.home.bestOpportunity')} />
      {best ? (
        <LoadCard load={best} />
      ) : (
        data && (
          <Card>
            <Text className="font-sans text-sm text-muted">{t('mobile.home.noOpportunities')}</Text>
          </Card>
        )
      )}
    </Screen>
  );
}
