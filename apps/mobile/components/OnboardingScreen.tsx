import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { useTranslations } from 'use-intl';
import { useAppDispatch } from '@/store/hooks';
import { completeOnboarding } from '@/store/settings-slice';

// Shown by app/_layout.tsx instead of the navigator until the user finishes
// it once (settings slice's hasCompletedOnboarding). Rendered outside the
// Stack on purpose: there's no route to deep-link or swipe back into.
// Extend this into a multi-step flow (intro slides, permissions, profile)
// — just call completeOnboarding() at the end.
export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const t = useTranslations();
  const dispatch = useAppDispatch();

  return (
    <View
      className="flex-1 justify-between bg-background px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }}
    >
      <View>
        <View className="mb-8 h-20 w-20 rounded-3xl bg-primary" />
        <Text className="font-sans-bold text-4xl text-ink">{t('mobile.onboarding.title')}</Text>
        <Text className="mt-3 font-sans text-base text-muted">{t('mobile.onboarding.body')}</Text>
      </View>
      <Button title={t('mobile.onboarding.cta')} onPress={() => dispatch(completeOnboarding())} />
    </View>
  );
}
