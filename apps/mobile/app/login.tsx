import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loginSchema } from '@dispatcher/shared';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useTranslations } from 'use-intl';
import { useAppDispatch } from '@/store/hooks';
import { signIn } from '@/store/session';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    // Same schema the api validates with (@dispatcher/shared).
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(t('auth.invalidFormat'));
      return;
    }
    setPending(true);
    const result = await dispatch(signIn(parsed.data));
    setPending(false);
    // On success the Stack.Protected guard navigates to the tabs by itself.
    if (signIn.rejected.match(result)) {
      // The api returns a stable code; the text comes from the user's language.
      setError(t(`errors.${result.payload ?? 'INTERNAL_ERROR'}`));
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background px-6"
      style={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 }}
    >
      <View className="flex-1">
        <View className="items-center">
          <BrandLogo width={200} />
        </View>
        <Text className="mt-4 text-center font-sans text-base text-muted">{t('mobile.login.subtitle')}</Text>

        <TextField
          className="mt-10"
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextField
          className="mt-4"
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        {error && <Text className="mt-4 font-sans text-sm text-danger">{error}</Text>}
      </View>
      <Button title={t('auth.signIn')} loading={pending} onPress={submit} />
      <Pressable className="mt-4 items-center py-2" accessibilityRole="link" onPress={() => router.push('/signup')}>
        <Text className="font-sans text-sm text-muted">
          {t('auth.noAccount')} <Text className="font-sans-bold text-primary">{t('auth.createAccount')}</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
