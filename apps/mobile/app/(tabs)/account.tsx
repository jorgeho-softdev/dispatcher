import { Text } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SettingRow } from '@/components/ui/SettingRow';
import { useTranslations } from 'use-intl';
import { appAlert } from '@/lib/app-alert';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectMe } from '@/store/auth-slice';
import { signOut } from '@/store/session';

export default function AccountScreen() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const me = useAppSelector(selectMe);

  const confirmSignOut = () =>
    appAlert(t('auth.signOutConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.signOut'), style: 'destructive', onPress: () => dispatch(signOut()) },
    ]);

  return (
    <Screen>
      <ScreenHeader title={t('mobile.account.title')} />
      <Card>
        <Text className="font-sans-bold text-lg text-ink">{me?.user.name}</Text>
        <Text className="font-sans text-sm text-muted">{me?.user.email}</Text>
      </Card>
      <Card padded={false} className="mt-4">
        <SettingRow label={t('mobile.account.company')} right={<Text className="font-sans text-sm text-muted">{me?.organization.name}</Text>} />
        <SettingRow label={t('mobile.account.role')} right={<Text className="font-sans text-sm text-muted">{me ? t(`domain.role.${me.role}`) : ''}</Text>} last />
      </Card>
      <Button className="mt-6" variant="secondary" title={t('auth.signOut')} onPress={confirmSignOut} />
    </Screen>
  );
}
