import * as Location from 'expo-location';
import type { LatLng } from '@dispatcher/shared';

export type LocationResult =
  | { status: 'granted'; position: LatLng }
  | { status: 'denied' }
  | { status: 'unavailable' };

/**
 * Foreground-only location ("while using the app"). Never tracks in the
 * background — that arrives with trips (Phase 3) and its own consent.
 */
export async function getCurrentPosition(): Promise<LocationResult> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return { status: 'denied' };
  try {
    // Balanced accuracy is plenty for "near me" and saves battery.
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { status: 'granted', position: { lat: fix.coords.latitude, lng: fix.coords.longitude } };
  } catch {
    return { status: 'unavailable' };
  }
}
