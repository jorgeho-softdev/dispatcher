import MapView, { Marker, Polyline } from 'react-native-maps';
import type { TripDto } from '@dispatcher/shared';
import { useColors } from '@/lib/theme';

/**
 * Route overview (mockup screen 4). Apple Maps on iOS; Android needs
 * GOOGLE_MAPS_ANDROID_API_KEY (app.config.ts). The line is straight until a
 * routing provider is integrated (same approximation as ETA/deadhead).
 */
export function TripMap({ trip }: { trip: TripDto }) {
  const colors = useColors();
  const origin = { latitude: trip.load.originLat, longitude: trip.load.originLng };
  const destination = { latitude: trip.load.destinationLat, longitude: trip.load.destinationLng };
  const current = trip.lastPosition ? { latitude: trip.lastPosition.lat, longitude: trip.lastPosition.lng } : null;
  const points = [origin, destination, ...(current ? [current] : [])];
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);

  return (
    <MapView
      style={{ height: 220, borderRadius: 16 }}
      userInterfaceStyle="dark"
      initialRegion={{
        latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
        longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
        latitudeDelta: Math.max(0.5, (Math.max(...lats) - Math.min(...lats)) * 1.6),
        longitudeDelta: Math.max(0.5, (Math.max(...lngs) - Math.min(...lngs)) * 1.6),
      }}
    >
      <Polyline coordinates={[origin, destination]} strokeColor={colors.primary} strokeWidth={4} />
      <Marker coordinate={origin} title={trip.load.originCity} pinColor={colors.primary} />
      <Marker coordinate={destination} title={trip.load.destinationCity} pinColor={colors.primary} />
      {current && <Marker coordinate={current} pinColor={colors.info} />}
    </MapView>
  );
}
