import Constants from 'expo-constants';

// API base URL (including /v1). Set EXPO_PUBLIC_API_URL per environment
// (.env / EAS env). In development we fall back to the machine running
// Metro, so a physical device on the same Wi-Fi reaches the local api.
function devApiUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:4000/v1`;
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? devApiUrl() : '')).replace(/\/$/, '');

if (!API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is not set for this build');
}
