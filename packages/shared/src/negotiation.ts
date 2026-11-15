import type { AutonomyLevel } from './constants';

// ════════════════════════════════════════════════════════════════════════
//  Negotiation domain: states, transitions and the POLICY ENGINE.
//  The LLM (or rule-based strategy) only PROPOSES numbers; every number is
//  checked here, in deterministic code, before anything reaches a broker.
//  See docs/ai-agent.md and docs/adr/0013-ai-agent-architecture.md.
// ════════════════════════════════════════════════════════════════════════

export const NEGOTIATION_STATUSES = [
  'ai_thinking', // a background job is running the strategy (LLM calls take seconds)
  'awaiting_send_approval', // AI prepared an offer; user must approve (assisted mode)
  'contacting_broker', // offer sent, waiting for the broker
  'awaiting_booking_approval', // broker agreed on a rate; user must approve booking
  'booking_requested', // booking sent, waiting for broker confirmation
  'booked',
  'rejected', // broker declined or the AI walked away
  'cancelled', // user cancelled
  'failed', // policy or load availability made it impossible
] as const;
export type NegotiationStatus = (typeof NEGOTIATION_STATUSES)[number];

export const TERMINAL_STATUSES: readonly NegotiationStatus[] = ['booked', 'rejected', 'cancelled', 'failed'];

/** Allowed state transitions (enforced by the api; clients use them to show actions). */
export const NEGOTIATION_TRANSITIONS: Record<NegotiationStatus, readonly NegotiationStatus[]> = {
  ai_thinking: ['awaiting_send_approval', 'contacting_broker', 'awaiting_booking_approval', 'rejected', 'failed', 'cancelled'],
  awaiting_send_approval: ['contacting_broker', 'cancelled', 'failed'],
  contacting_broker: ['ai_thinking', 'awaiting_booking_approval', 'rejected', 'failed', 'cancelled'],
  awaiting_booking_approval: ['booking_requested', 'cancelled', 'failed'],
  booking_requested: ['booked', 'failed'],
  booked: [],
  rejected: [],
  cancelled: [],
  failed: [],
};

export function canTransition(from: NegotiationStatus, to: NegotiationStatus): boolean {
  return NEGOTIATION_TRANSITIONS[from].includes(to);
}

export const NEGOTIATION_ACTIONS = ['approve_send', 'adjust_offer', 'approve_booking', 'cancel'] as const;
export type NegotiationAction = (typeof NEGOTIATION_ACTIONS)[number];

/** What the user can do in each state. */
export function allowedActions(status: NegotiationStatus): NegotiationAction[] {
  switch (status) {
    case 'awaiting_send_approval':
      return ['approve_send', 'adjust_offer', 'cancel'];
    case 'ai_thinking':
    case 'contacting_broker':
      return ['cancel'];
    case 'awaiting_booking_approval':
      return ['approve_booking', 'cancel'];
    default:
      return [];
  }
}

export const NEGOTIATION_EVENT_TYPES = [
  'ai_proposed',
  'ai_countered',
  'ai_accepted',
  'ai_walked_away',
  'policy_adjusted',
  'policy_blocked',
  'user_approved_send',
  'user_adjusted',
  'user_approved_booking',
  'user_cancelled',
  'offer_sent',
  'broker_countered',
  'broker_accepted',
  'broker_rejected',
  'booking_requested',
  'booking_confirmed',
  'booking_declined',
  'load_unavailable',
] as const;
export type NegotiationEventType = (typeof NEGOTIATION_EVENT_TYPES)[number];

export const NEGOTIATION_ACTORS = ['ai', 'user', 'broker', 'system'] as const;
export type NegotiationActor = (typeof NEGOTIATION_ACTORS)[number];

/** Reason codes for deterministic explanations (translated in domain.aiReason.*). */
export const AI_REASON_CODES = [
  'target_markup',
  'counter_midpoint',
  'accept_meets_minimums',
  'walk_away_below_minimums',
  'max_rounds_reached',
  'clamped_to_floor',
  'clamped_to_ceiling',
  'unprofitable_at_ceiling',
] as const;
export type AiReasonCode = (typeof AI_REASON_CODES)[number];

/** Max offer/counter rounds before the AI walks away. */
export const MAX_NEGOTIATION_ROUNDS = 3;

// ── Policy engine ──────────────────────────────────────────────────────

export interface PolicyLimits {
  postedRate: number;
  distanceKm: number;
  deadheadKm: number;
  costPerKm: number;
  minRatePerKm: number;
  minMarginPct: number;
  maxCounterOfferPct: number;
}

export interface RateBounds {
  /** Lowest rate the carrier accepts: max(min rate/km × loaded km, rate that yields the minimum margin). */
  floor: number;
  /** Highest rate the AI may ask: posted rate × (1 + max counter-offer %). */
  ceiling: number;
  /** False when even the ceiling doesn't meet the carrier's minimums. */
  viable: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Offers are quoted in whole tens, like real broker rates. */
export const roundRate = (n: number) => Math.round(n / 10) * 10;

export function rateBounds(l: PolicyLimits): RateBounds {
  const costs = (l.distanceKm + l.deadheadKm) * l.costPerKm;
  const byRatePerKm = l.minRatePerKm * l.distanceKm;
  const byMargin = l.minMarginPct >= 100 ? Infinity : costs / (1 - l.minMarginPct / 100);
  const floor = round2(Math.max(byRatePerKm, byMargin));
  const ceiling = round2(l.postedRate * (1 + l.maxCounterOfferPct / 100));
  return { floor, ceiling, viable: floor <= ceiling };
}

export type PolicyDecision =
  | { ok: true; amount: number; adjusted: false }
  | { ok: true; amount: number; adjusted: true; reason: 'clamped_to_floor' | 'clamped_to_ceiling' }
  | { ok: false; reason: 'unprofitable_at_ceiling' };

/**
 * Validates an outbound offer. Offers never go below the posted rate or the
 * carrier's floor, and never above the ceiling. Out-of-range proposals are
 * clamped (and audited); impossible ones are blocked.
 */
export function checkOffer(amount: number, l: PolicyLimits): PolicyDecision {
  const b = rateBounds(l);
  if (!b.viable) return { ok: false, reason: 'unprofitable_at_ceiling' };
  const low = Math.max(b.floor, l.postedRate);
  if (amount < low) return { ok: true, amount: Math.min(b.ceiling, roundRate(Math.ceil(low / 10) * 10)), adjusted: true, reason: 'clamped_to_floor' };
  if (amount > b.ceiling) return { ok: true, amount: Math.floor(b.ceiling / 10) * 10, adjusted: true, reason: 'clamped_to_ceiling' };
  return { ok: true, amount, adjusted: false };
}

/** A broker's offer is acceptable when it meets the carrier's floor. */
export function brokerOfferAcceptable(amount: number, l: PolicyLimits): boolean {
  return amount >= rateBounds(l).floor;
}

export type ApprovalStep = 'send_offer' | 'book';

/**
 * Human-in-the-loop rules per autonomy level:
 *  - assisted:  every message to the broker and the booking need approval
 *  - semi_auto: AI negotiates within limits; booking needs approval
 *  - auto:      reserved for a later phase — behaves like semi_auto for now
 */
export function requiresApproval(autonomy: AutonomyLevel, step: ApprovalStep): boolean {
  if (step === 'book') return true;
  return autonomy === 'assisted';
}
