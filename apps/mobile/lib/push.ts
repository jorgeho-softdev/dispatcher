import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermission } from './notifications';

/**
 * Expo push token for this device, or null when push isn't possible
 * (permission denied, simulator, or the EAS project isn't linked yet —
 * run `npx eas-cli init`). Never throws.
 */
export async function getPushToken(ask: boolean): Promise<{ token: string; platform: 'ios' | 'android' } | null> {
  try {
    const granted = ask
      ? await requestNotificationPermission()
      : (await Notifications.getPermissionsAsync()).granted;
    if (!granted) return null;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) {
      if (__DEV__) console.warn('[push] No EAS projectId — run `npx eas-cli init` to enable push.');
      return null;
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
  } catch (error) {
    if (__DEV__) console.warn('[push] token unavailable', error);
    return null;
  }
}
