import type { Currency } from './constants';
import { estimateRoadKm, type LatLng } from './geo';

// ════════════════════════════════════════════════════════════════════════
//  Trips (Phase 3): lifecycle, documents, expenses, ETA and real profit.
//  See docs/trips.md.
// ════════════════════════════════════════════════════════════════════════

export const TRIP_STATUSES = [
  'scheduled', // booked, driver hasn't reached the pickup yet
  'at_pickup', // driver at the shipper
  'in_transit', // loaded, on the way ("En ruta")
  'delivered', // at the consignee; waiting for POD / close-out
  'completed', // POD uploaded and trip closed: real profit is final
  'cancelled',
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
  scheduled: ['at_pickup', 'cancelled'],
  at_pickup: ['in_transit', 'cancelled'],
  in_transit: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

export function canTripTransition(from: TripStatus, to: TripStatus): boolean {
  return TRIP_TRANSITIONS[from].includes(to);
}

/** Driver-facing progress steps (mockup stepper: Recogida → En ruta → Entrega). */
export const TRIP_PROGRESS = ['at_pickup', 'in_transit', 'delivered'] as const satisfies readonly TripStatus[];

/** Status the driver moves to next with the main button, if any. */
export function nextTripStatus(status: TripStatus): TripStatus | null {
  switch (status) {
    case 'scheduled':
      return 'at_pickup';
    case 'at_pickup':
      return 'in_transit';
    case 'in_transit':
      return 'delivered';
    default:
      return null;
  }
}

export const ACTIVE_TRIP_STATUSES: readonly TripStatus[] = ['scheduled', 'at_pickup', 'in_transit', 'delivered'];

export const DOCUMENT_TYPES = ['rate_confirmation', 'bol', 'pod', 'receipt', 'other'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Files accepted for upload (photos from the phone camera or PDFs). */
export const ALLOWED_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'] as const;
export type UploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const EXPENSE_CATEGORIES = ['fuel', 'tolls', 'parking', 'maintenance', 'lumper', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** A trip can be closed only after delivery and with proof of delivery. */
export function canCompleteTrip(status: TripStatus, hasPod: boolean): boolean {
  return status === 'delivered' && hasPod;
}

// ── ETA ────────────────────────────────────────────────────────────────

/** Average truck speed used for ETA when no recent speed is known (km/h). */
export const DEFAULT_AVG_SPEED_KMH = 75;

export interface EtaEstimate {
  remainingKm: number;
  etaAt: Date;
}

/**
 * Remaining road km and ETA to the destination from the current position.
 * Uses the observed speed when plausible (30–110 km/h), else the default.
 * Same road-factor approximation as deadhead (docs/adr/0012).
 */
export function estimateEta(position: LatLng, destination: LatLng, now: Date, speedKmh?: number | null): EtaEstimate {
  const remainingKm = estimateRoadKm(position, destination);
  const speed = speedKmh && speedKmh >= 30 && speedKmh <= 110 ? speedKmh : DEFAULT_AVG_SPEED_KMH;
  return { remainingKm, etaAt: new Date(now.getTime() + (remainingKm / speed) * 3_600_000) };
}

// ── Money ──────────────────────────────────────────────────────────────

export interface TripFinancials {
  currency: Currency;
  /** Rate agreed with the broker. */
  rate: number;
  /** What we estimated at booking time (loaded + deadhead km × cost/km). */
  estimatedCosts: number;
  estimatedProfit: number;
  /** Sum of recorded expenses (fuel, tolls…). */
  actualExpenses: number;
  /** rate − actual expenses ("Ganancia real"). */
  actualProfit: number;
  actualMarginPct: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function tripFinancials(input: {
  currency: Currency;
  rate: number;
  plannedKm: number;
  costPerKm: number;
  expenses: readonly { amount: number }[];
}): TripFinancials {
  const estimatedCosts = round2(input.plannedKm * input.costPerKm);
  const actualExpenses = round2(input.expenses.reduce((sum, e) => sum + e.amount, 0));
  const actualProfit = round2(input.rate - actualExpenses);
  return {
    currency: input.currency,
    rate: input.rate,
    estimatedCosts,
    estimatedProfit: round2(input.rate - estimatedCosts),
    actualExpenses,
    actualProfit,
    actualMarginPct: input.rate > 0 ? round2((actualProfit / input.rate) * 100) : 0,
  };
}

/** Human trip code shown in the app ("TR-1045"). */
export function tripCode(sequence: number): string {
  return `TR-${sequence}`;
}
