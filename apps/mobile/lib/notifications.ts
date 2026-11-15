import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Locale } from '@dispatcher/i18n';
import { translatorFor } from './i18n';

// Without a handler, iOS silently drops a notification that fires while the
// app is in the foreground instead of showing it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const DAILY_REMINDER_ID = 'daily-reminder';

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Uses a fixed identifier so rescheduling replaces the previous reminder
// instead of cancelling every scheduled notification in the app.
export async function scheduleDailyReminder(
  locale: Locale,
  hour = 19,
  minute = 0,
): Promise<void> {
  await cancelDailyReminder();
  const t = translatorFor(locale, 'mobile');
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: t('notifications.reminderTitle'),
      body: t('notifications.reminderBody'),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
}
