import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale, useTranslations } from 'use-intl';
import { registerSchema } from '@dispatcher/shared';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useAppDispatch } from '@/store/hooks';
import { signUp } from '@/store/session';

/** Self sign-up: the new user becomes owner of a new organization. */
export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const t = useTranslations();
  const locale = useLocale();
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    // Same schema the api validates with (@dispatcher/shared).
    const parsed = registerSchema.safeParse({ name, companyName, email, password, locale });
    if (!parsed.success) {
      setError(t('auth.signupInvalid'));
      return;
    }
    setPending(true);
    const result = await dispatch(signUp(parsed.data));
    setPending(false);
    // On success the Stack.Protected guard navigates to the tabs by itself.
    if (signUp.rejected.match(result)) {
      setError(t(`errors.${result.payload ?? 'INTERNAL_ERROR'}`));
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-6"
        contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center">
          <BrandLogo width={160} />
        </View>
        <Text className="mt-4 text-center font-sans text-base text-muted">{t('auth.signupSubtitle')}</Text>

        <TextField
          className="mt-8"
          label={t('auth.name')}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          maxLength={100}
        />
        <TextField
          className="mt-4"
          label={t('auth.companyName')}
          value={companyName}
          onChangeText={setCompanyName}
          autoComplete="organization"
          textContentType="organizationName"
          maxLength={120}
        />
        <Text className="mt-1 font-sans text-xs text-muted">{t('auth.companyHint')}</Text>
        <TextField
          className="mt-4"
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
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={submit}
        />
        <Text className="mt-1 font-sans text-xs text-muted">{t('auth.passwordHint')}</Text>
        {error && <Text className="mt-4 font-sans text-sm text-danger">{error}</Text>}

        <View className="mt-8">
          <Button title={t('auth.createAccount')} loading={pending} onPress={submit} />
        </View>
        <Pressable className="mt-6 items-center py-2" accessibilityRole="link" onPress={() => router.back()}>
          <Text className="font-sans text-sm text-muted">
            {t('auth.haveAccount')} <Text className="font-sans-bold text-primary">{t('auth.signIn')}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
