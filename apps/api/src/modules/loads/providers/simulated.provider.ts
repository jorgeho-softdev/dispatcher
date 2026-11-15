import type { City, EquipmentType } from '@dispatcher/shared';
import type {
  LoadProvider,
  LoadSearchCriteria,
  NormalizedLoad,
} from './load-provider';

// Realistic but FAKE loads for the MVP (Alberta / BC / Saskatchewan lanes).
// Every load is flagged isSimulated=true and brokers are labelled "(DEMO)",
// so they can never be mistaken for real opportunities.

const C = {
  calgary: { city: 'Calgary', province: 'AB', lat: 51.0447, lng: -114.0719 },
  edmonton: { city: 'Edmonton', province: 'AB', lat: 53.5461, lng: -113.4938 },
  redDeer: { city: 'Red Deer', province: 'AB', lat: 52.2681, lng: -113.8112 },
  lethbridge: {
    city: 'Lethbridge',
    province: 'AB',
    lat: 49.6956,
    lng: -112.8451,
  },
  medicineHat: {
    city: 'Medicine Hat',
    province: 'AB',
    lat: 50.0405,
    lng: -110.6766,
  },
  grandePrairie: {
    city: 'Grande Prairie',
    province: 'AB',
    lat: 55.1707,
    lng: -118.7947,
  },
  fortMcMurray: {
    city: 'Fort McMurray',
    province: 'AB',
    lat: 56.7267,
    lng: -111.381,
  },
  vancouver: {
    city: 'Vancouver',
    province: 'BC',
    lat: 49.2827,
    lng: -123.1207,
  },
  kelowna: { city: 'Kelowna', province: 'BC', lat: 49.888, lng: -119.496 },
  kamloops: { city: 'Kamloops', province: 'BC', lat: 50.6745, lng: -120.3273 },
  saskatoon: { city: 'Saskatoon', province: 'SK', lat: 52.1332, lng: -106.67 },
  regina: { city: 'Regina', province: 'SK', lat: 50.4452, lng: -104.6189 },
} satisfies Record<string, City>;

/** Approximate road distances (km). */
const LANES: [City, City, number][] = [
  [C.calgary, C.edmonton, 300],
  [C.calgary, C.redDeer, 148],
  [C.redDeer, C.edmonton, 150],
  [C.lethbridge, C.medicineHat, 168],
  [C.calgary, C.lethbridge, 210],
  [C.calgary, C.vancouver, 970],
  [C.calgary, C.kelowna, 605],
  [C.edmonton, C.grandePrairie, 460],
  [C.edmonton, C.fortMcMurray, 435],
  [C.edmonton, C.saskatoon, 525],
  [C.calgary, C.regina, 760],
  [C.vancouver, C.kamloops, 355],
];

const EQUIPMENT: Record<
  EquipmentType,
  { ratePerKm: [number, number]; weightKg: [number, number] }
> = {
  cargo_van: { ratePerKm: [1.8, 2.6], weightKg: [200, 1500] },
  sprinter: { ratePerKm: [2.0, 3.0], weightKg: [300, 1800] },
  box_truck: { ratePerKm: [2.6, 4.4], weightKg: [1000, 4500] },
  dry_van: { ratePerKm: [2.8, 4.0], weightKg: [5000, 20000] },
  reefer: { ratePerKm: [3.2, 4.6], weightKg: [5000, 18000] },
  flatbed: { ratePerKm: [3.0, 4.5], weightKg: [4000, 20000] },
};

const BROKERS = [
  'Prairie Freight Partners (DEMO)',
  'Rockies Logistics Brokerage (DEMO)',
  'Northern Lane Freight (DEMO)',
  'Westcoast Cargo Connect (DEMO)',
];

/** Small deterministic PRNG (mulberry32) so seeds are reproducible. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SimulatedLoadProvider implements LoadProvider {
  readonly source = 'simulated' as const;
  readonly capabilities = { canBook: false, canNegotiate: true };

  constructor(
    private readonly seed = 42,
    private readonly now: () => Date = () => new Date(),
  ) {}

  search(criteria: LoadSearchCriteria = {}): Promise<NormalizedLoad[]> {
    const rand = prng(this.seed);
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
    const between = (min: number, max: number) => min + rand() * (max - min);

    const allowed =
      criteria.equipment ??
      (['cargo_van', 'sprinter', 'box_truck'] as EquipmentType[]);
    const limit = criteria.limit ?? 40;
    const base = this.now();
    const loads: NormalizedLoad[] = [];

    for (let i = 0; i < limit; i++) {
      const [a, b, distanceKm] = pick(LANES);
      const [origin, destination] = rand() < 0.5 ? [a, b] : [b, a];
      if (
        criteria.originProvinces &&
        !criteria.originProvinces.includes(origin.province)
      )
        continue;

      const equipment = pick(allowed);
      const spec = EQUIPMENT[equipment];
      const rate = Math.max(
        250,
        Math.round((distanceKm * between(...spec.ratePerKm)) / 10) * 10,
      );

      const pickupAt = new Date(base);
      pickupAt.setDate(pickupAt.getDate() + 1 + Math.floor(rand() * 6));
      pickupAt.setHours(6 + Math.floor(rand() * 10), 0, 0, 0);

      loads.push({
        source: 'simulated',
        externalId: `sim-${this.seed}-${i}`,
        isSimulated: true,
        originCity: origin.city,
        originProvince: origin.province,
        originLat: origin.lat,
        originLng: origin.lng,
        destinationCity: destination.city,
        destinationProvince: destination.province,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        pickupAt,
        distanceKm,
        weightKg: Math.round(between(...spec.weightKg) / 50) * 50,
        equipment,
        postedRate: rate,
        currency: 'CAD',
        broker: { name: pick(BROKERS) },
      });
    }
    return Promise.resolve(loads);
  }
}
