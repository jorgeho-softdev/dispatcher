import * as SecureStore from 'expo-secure-store';

// Refresh token in the iOS Keychain / Android Keystore — never in MMKV,
// AsyncStorage or Redux. Only readable while the device is unlocked.
const REFRESH_TOKEN_KEY = 'auth.refreshToken';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureTokens = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY, OPTIONS),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, OPTIONS),
  clear: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, OPTIONS),
};
