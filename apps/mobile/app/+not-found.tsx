import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { useTranslations } from 'use-intl';

export default function NotFoundScreen() {
  const t = useTranslations();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center bg-background p-5">
        <Text className="font-sans-bold text-xl text-ink">404</Text>
        <Link href="/" className="mt-4 font-sans-semibold text-primary">
          {t('common.back')}
        </Link>
      </View>
    </>
  );
}
