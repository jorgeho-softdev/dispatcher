import { Linking, Text } from 'react-native';
import { Switch } from 'react-native';
import Constants from 'expo-constants';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { SettingRow } from '@/components/ui/SettingRow';
import { ChoicePills } from '@/components/ui/ChoicePills';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { resetOnboarding, selectSettings, updateSettings as updateSettingsAction } from '@/store/settings-slice';
import type { AppSettings } from '@/types';
import { resetData } from '@/store/store-coordinator';
import { useLocale, useTranslations } from 'use-intl';
import { LANGUAGE_OPTIONS } from '@/lib/i18n';
import { themeList } from '@/lib/themes';
import { appAlert } from '@/lib/app-alert';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/lib/urls';
import { useColors } from '@/lib/theme';
import {
  cancelDailyReminder,
  requestNotificationPermission,
  scheduleDailyReminder,
} from '@/lib/notifications';

export default function SettingsScreen() {
  const t = useTranslations();
  const locale = useLocale();
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectSettings);
  const updateSettings = (patch: Partial<AppSettings>) => dispatch(updateSettingsAction(patch));
  const colors = useColors();

  const toggleNotifications = async (enabled: boolean) => {
    if (!enabled) {
      updateSettings({ notificationsEnabled: false });
      await cancelDailyReminder();
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      appAlert(t('mobile.notifications.deniedTitle'), t('mobile.notifications.deniedBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('mobile.settings.title'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    updateSettings({ notificationsEnabled: true });
    await scheduleDailyReminder(locale);
  };

  const confirmReset = () =>
    appAlert(t('mobile.settings.resetDataTitle'), t('mobile.settings.resetDataBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mobile.settings.resetDataConfirm'), style: 'destructive', onPress: resetData },
    ]);

  return (
    <Screen>
      <ScreenHeader title={t('mobile.settings.title')} showBack showSettings={false} />

      <SectionTitle title={t('mobile.settings.appearance')} />
      <ChoicePills
        options={themeList.map((theme) => ({ key: theme.id, label: theme.name }))}
        value={settings.themeId}
        onChange={(themeId) => updateSettings({ themeId })}
      />

      <SectionTitle title={t('mobile.settings.language')} />
      <ChoicePills
        options={LANGUAGE_OPTIONS}
        value={settings.language}
        onChange={(lang) => updateSettings({ language: lang })}
      />

      <SectionTitle title={t('mobile.notifications.section')} />
      <Card padded={false}>
        <SettingRow
          label={t('mobile.notifications.reminder')}
          last
          right={
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          }
        />
      </Card>


      <SectionTitle title={t('mobile.settings.legal')} />
      <Card padded={false}>
        <SettingRow label={t('mobile.settings.privacyPolicy')} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} />
        <SettingRow label={t('mobile.settings.termsOfUse')} onPress={() => Linking.openURL(TERMS_OF_USE_URL)} last />
      </Card>

      <SectionTitle title={t('mobile.settings.data')} />
      <Card padded={false}>
        <SettingRow label={t('mobile.settings.resetData')} onPress={confirmReset} destructive last={!__DEV__} />
        {__DEV__ && <SettingRow label={t('mobile.settings.devResetOnboarding')} onPress={() => dispatch(resetOnboarding())} last />}
      </Card>

      <Text className="mt-6 text-center font-sans text-xs text-muted-light">
        {t('mobile.settings.appVersion', { version: Constants.expoConfig?.version ?? '' })}
      </Text>
    </Screen>
  );
}
