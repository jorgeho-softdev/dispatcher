import type { EquipmentType } from './constants';
import { estimateProfit } from './profit';

// ════════════════════════════════════════════════════════════════════════
//  Load ↔ vehicle matching (the "98% Match" in the app).
//  Deterministic and explainable: every point comes with a reason code the
//  UI translates (domain.matchReason.<code>). The AI agent (Phase 2) uses
//  this score; it never invents it. Algorithm: docs/matching.md.
// ════════════════════════════════════════════════════════════════════════

/** Which vehicle types can haul a load posted for a given equipment. */
export const EQUIPMENT_COMPATIBILITY: Record<EquipmentType, readonly EquipmentType[]> = {
  cargo_van: ['cargo_van', 'sprinter', 'box_truck'],
  sprinter: ['sprinter', 'box_truck'],
  box_truck: ['box_truck'],
  dry_van: ['dry_van'],
  reefer: ['reefer'],
  flatbed: ['flatbed'],
};

export const MATCH_WEIGHTS = {
  profitability: 35,
  ratePerKm: 25,
  deadhead: 20,
  pickupTiming: 10,
  lanePreference: 10,
} as const;

/** Loads at or above this score count as "opportunities". */
export const OPPORTUNITY_THRESHOLD = 70;

export const MATCH_REASONS = [
  // positive
  'equipment_ideal',
  'high_margin',
  'good_rate',
  'short_deadhead',
  'pickup_soon',
  'preferred_lane',
  // negative / informative
  'equipment_larger',
  'low_margin',
  'low_rate',
  'long_deadhead',
  'deadhead_unknown',
  'pickup_far_out',
  // hard fails (score 0)
  'equipment_incompatible',
  'over_capacity',
  'avoided_region',
  'pickup_passed',
] as const;
export type MatchReason = (typeof MATCH_REASONS)[number];

export interface MatchReasonItem {
  code: MatchReason;
  tone: 'positive' | 'negative';
}

export interface MatchInput {
  load: {
    equipment: EquipmentType;
    weightKg: number;
    postedRate: number;
    distanceKm: number;
    pickupAt: Date;
    originProvince: string;
    destinationProvince: string;
  };
  vehicle: {
    equipment: EquipmentType;
    capacityKg: number;
    costPerKm: number;
  };
  /** Empty km from the vehicle to the pickup; null when position is unknown. */
  deadheadKm: number | null;
  preferences: {
    minRatePerKm: number;
    minMarginPct: number;
    maxDeadheadKm: number;
    preferredProvinces: readonly string[];
    avoidProvinces: readonly string[];
  };
  now?: Date;
}

export interface MatchResult {
  /** 0–100. 0 means the vehicle can't take the load (see `compatible`). */
  score: number;
  compatible: boolean;
  reasons: MatchReasonItem[];
  profit: number;
  marginPct: number;
  ratePerKm: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const HOUR = 3_600_000;

export function scoreMatch(input: MatchInput): MatchResult {
  const { load, vehicle, preferences: prefs } = input;
  const now = input.now ?? new Date();
  const estimate = estimateProfit({
    postedRate: load.postedRate,
    distanceKm: load.distanceKm,
    deadheadKm: input.deadheadKm ?? 0,
    costPerKm: vehicle.costPerKm,
  });
  const base = { profit: estimate.profit, marginPct: estimate.marginPct, ratePerKm: estimate.ratePerKm };

  // ── Hard constraints ───────────────────────────────────────────────────
  const fail = (code: MatchReason): MatchResult => ({
    ...base,
    score: 0,
    compatible: false,
    reasons: [{ code, tone: 'negative' }],
  });
  if (!EQUIPMENT_COMPATIBILITY[load.equipment].includes(vehicle.equipment)) return fail('equipment_incompatible');
  if (load.weightKg > vehicle.capacityKg) return fail('over_capacity');
  if (prefs.avoidProvinces.includes(load.originProvince) || prefs.avoidProvinces.includes(load.destinationProvince)) {
    return fail('avoided_region');
  }
  if (load.pickupAt.getTime() < now.getTime()) return fail('pickup_passed');

  const reasons: MatchReasonItem[] = [];
  const add = (code: MatchReason, tone: MatchReasonItem['tone']) => reasons.push({ code, tone });
  let score = 0;

  // Equipment: exact type is ideal; a bigger vehicle works but costs more.
  if (vehicle.equipment === load.equipment) add('equipment_ideal', 'positive');
  else add('equipment_larger', 'negative');

  // Profitability: full points at minMargin + 20 pts, zero at 0 % margin.
  const marginTarget = prefs.minMarginPct + 20;
  score += MATCH_WEIGHTS.profitability * clamp01(estimate.marginPct / marginTarget);
  if (estimate.marginPct >= marginTarget) add('high_margin', 'positive');
  else if (estimate.marginPct < prefs.minMarginPct) add('low_margin', 'negative');

  // Rate per km: zero at 50 % of the minimum, full at 150 %.
  const rpkLow = prefs.minRatePerKm * 0.5;
  const rpkHigh = prefs.minRatePerKm * 1.5;
  score += MATCH_WEIGHTS.ratePerKm * clamp01((estimate.ratePerKm - rpkLow) / (rpkHigh - rpkLow));
  if (estimate.ratePerKm >= prefs.minRatePerKm * 1.2) add('good_rate', 'positive');
  else if (estimate.ratePerKm < prefs.minRatePerKm) add('low_rate', 'negative');

  // Deadhead: full points at 0 km, zero at the carrier's maximum.
  if (input.deadheadKm === null) {
    score += MATCH_WEIGHTS.deadhead / 2;
    add('deadhead_unknown', 'negative');
  } else {
    score += MATCH_WEIGHTS.deadhead * clamp01(1 - input.deadheadKm / Math.max(1, prefs.maxDeadheadKm));
    if (input.deadheadKm <= prefs.maxDeadheadKm * 0.25) add('short_deadhead', 'positive');
    else if (input.deadheadKm > prefs.maxDeadheadKm) add('long_deadhead', 'negative');
  }

  // Pickup timing: full within 72 h, decays to zero at 7 days.
  const hoursAhead = (load.pickupAt.getTime() - now.getTime()) / HOUR;
  score += MATCH_WEIGHTS.pickupTiming * (hoursAhead <= 72 ? 1 : clamp01(1 - (hoursAhead - 72) / (168 - 72)));
  if (hoursAhead <= 48) add('pickup_soon', 'positive');
  else if (hoursAhead > 120) add('pickup_far_out', 'negative');

  // Lane preference: neutral when the carrier hasn't set any.
  if (prefs.preferredProvinces.length === 0) {
    score += MATCH_WEIGHTS.lanePreference / 2;
  } else if (
    prefs.preferredProvinces.includes(load.originProvince) ||
    prefs.preferredProvinces.includes(load.destinationProvince)
  ) {
    score += MATCH_WEIGHTS.lanePreference;
    add('preferred_lane', 'positive');
  }

  return { ...base, score: Math.round(score), compatible: true, reasons };
}
