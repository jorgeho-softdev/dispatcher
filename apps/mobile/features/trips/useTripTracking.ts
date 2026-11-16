import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import * as Location from 'expo-location';
import type { TripLocationsInput, TripStatus } from '@dispatcher/shared';
import { useRecordTripLocationsMutation } from '@/store/api';

const TRACKED: readonly TripStatus[] = ['scheduled', 'at_pickup', 'in_transit'];
const FLUSH_EVERY_MS = 60_000;
const FLUSH_AT_POINTS = 10;

export type TrackingState = 'off' | 'denied' | 'tracking';

/**
 * Foreground GPS while the trip screen is open (battery-friendly: ~200 m /
 * 30 s), sent to the api in batches. Background tracking during the whole
 * trip is a follow-up with its own consent (docs/trips.md).
 */
export function useTripTracking(tripId: string, status: TripStatus | undefined): TrackingState {
  const focused = useIsFocused();
  const [state, setState] = useState<TrackingState>('off');
  const [record] = useRecordTripLocationsMutation();
  const buffer = useRef<TripLocationsInput['points']>([]);
  const active = focused && status !== undefined && TRACKED.includes(status);

  useEffect(() => {
    if (!active) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    const flush = () => {
      const points = buffer.current.splice(0, 100);
      if (points.length > 0) void record({ id: tripId, points });
    };

    void (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (!granted) {
        setState('denied');
        return;
      }
      setState('tracking');
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 200, timeInterval: 30_000 },
        (fix) => {
          buffer.current.push({
            lat: fix.coords.latitude,
            lng: fix.coords.longitude,
            recordedAt: new Date(fix.timestamp),
            // m/s → km/h; negative means unknown.
            speedKmh: fix.coords.speed && fix.coords.speed > 0 ? fix.coords.speed * 3.6 : undefined,
          });
          // First fix goes out right away so the ETA appears immediately.
          if (buffer.current.length === 1 || buffer.current.length >= FLUSH_AT_POINTS) flush();
        },
      );
    })();

    const timer = setInterval(flush, FLUSH_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription?.remove();
      flush();
      setState('off');
    };
  }, [active, record, tripId]);

  return state;
}
