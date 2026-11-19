// Geography helpers shared by api, web and mobile.

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Road distance ≈ straight-line distance × this factor. Used for deadhead and
 * for estimating manual-load distances until a routing provider (Mapbox /
 * Google) is integrated. 1.25 is a common average for Canadian highway
 * networks; documented in docs/adr/0012-matching-and-geo.md.
 */
export const ROAD_DISTANCE_FACTOR = 1.25;

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km (haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Estimated road km between two points, rounded to 0.1 km. */
export function estimateRoadKm(a: LatLng, b: LatLng): number {
  return Math.round(haversineKm(a, b) * ROAD_DISTANCE_FACTOR * 10) / 10;
}

export const PROVINCES = ['AB', 'BC', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU'] as const;
export type Province = (typeof PROVINCES)[number];

export interface City extends LatLng {
  city: string;
  province: Province;
}

/**
 * Freight hubs used by the city pickers (manual loads, vehicle home base).
 * Proper names are not translated. Extend as the service area grows; real
 * geocoding (Mapbox/Google) replaces this when free-text addresses are needed.
 */
export const CANADIAN_CITIES: readonly City[] = [
  // Alberta
  { city: 'Calgary', province: 'AB', lat: 51.0447, lng: -114.0719 },
  { city: 'Edmonton', province: 'AB', lat: 53.5461, lng: -113.4938 },
  { city: 'Red Deer', province: 'AB', lat: 52.2681, lng: -113.8112 },
  { city: 'Lethbridge', province: 'AB', lat: 49.6956, lng: -112.8451 },
  { city: 'Medicine Hat', province: 'AB', lat: 50.0405, lng: -110.6766 },
  { city: 'Grande Prairie', province: 'AB', lat: 55.1707, lng: -118.7947 },
  { city: 'Fort McMurray', province: 'AB', lat: 56.7267, lng: -111.381 },
  { city: 'Lloydminster', province: 'AB', lat: 53.2783, lng: -110.005 },
  { city: 'Airdrie', province: 'AB', lat: 51.2917, lng: -114.0144 },
  { city: 'Banff', province: 'AB', lat: 51.1784, lng: -115.5708 },
  // British Columbia
  { city: 'Vancouver', province: 'BC', lat: 49.2827, lng: -123.1207 },
  { city: 'Surrey', province: 'BC', lat: 49.1913, lng: -122.849 },
  { city: 'Kelowna', province: 'BC', lat: 49.888, lng: -119.496 },
  { city: 'Kamloops', province: 'BC', lat: 50.6745, lng: -120.3273 },
  { city: 'Prince George', province: 'BC', lat: 53.9171, lng: -122.7497 },
  { city: 'Abbotsford', province: 'BC', lat: 49.0504, lng: -122.3045 },
  // Saskatchewan
  { city: 'Saskatoon', province: 'SK', lat: 52.1332, lng: -106.67 },
  { city: 'Regina', province: 'SK', lat: 50.4452, lng: -104.6189 },
  // Manitoba
  { city: 'Winnipeg', province: 'MB', lat: 49.8951, lng: -97.1384 },
  { city: 'Brandon', province: 'MB', lat: 49.8485, lng: -99.95 },
  // Ontario
  { city: 'Toronto', province: 'ON', lat: 43.6532, lng: -79.3832 },
  { city: 'Mississauga', province: 'ON', lat: 43.589, lng: -79.6441 },
  { city: 'Brampton', province: 'ON', lat: 43.7315, lng: -79.7624 },
  { city: 'Ottawa', province: 'ON', lat: 45.4215, lng: -75.6972 },
  { city: 'Hamilton', province: 'ON', lat: 43.2557, lng: -79.8711 },
  { city: 'London', province: 'ON', lat: 42.9849, lng: -81.2453 },
  { city: 'Windsor', province: 'ON', lat: 42.3149, lng: -83.0364 },
  { city: 'Thunder Bay', province: 'ON', lat: 48.3809, lng: -89.2477 },
  // Quebec
  { city: 'Montréal', province: 'QC', lat: 45.5019, lng: -73.5674 },
  { city: 'Québec', province: 'QC', lat: 46.8139, lng: -71.208 },
  // Atlantic
  { city: 'Moncton', province: 'NB', lat: 46.0878, lng: -64.7782 },
  { city: 'Halifax', province: 'NS', lat: 44.6488, lng: -63.5752 },
];

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

/** Finds a catalog city by name + province (accent/case-insensitive). */
export function findCity(city: string, province: string): City | undefined {
  const c = normalize(city);
  const p = province.trim().toUpperCase();
  return CANADIAN_CITIES.find((x) => x.province === p && normalize(x.city) === c);
}
