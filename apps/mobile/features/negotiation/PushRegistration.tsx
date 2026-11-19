import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { getPushToken } from '@/lib/push';
import { useRegisterDeviceMutation } from '@/store/api';

/**
 * Mounted while signed in: refreshes this phone's push token (only if the
 * user already granted permission — we ask when they start a negotiation)
 * and opens the negotiation when a notification is tapped.
 */
export function PushRegistration() {
  const router = useRouter();
  const [registerDevice] = useRegisterDeviceMutation();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    void getPushToken(false).then((device) => {
      if (device) void registerDevice(device);
    });
  }, [registerDevice]);

  useEffect(() => {
    const id = response?.notification.request.content.data?.negotiationId;
    if (typeof id === 'string') router.push({ pathname: '/negotiations/[id]', params: { id } });
  }, [response, router]);

  return null;
}
