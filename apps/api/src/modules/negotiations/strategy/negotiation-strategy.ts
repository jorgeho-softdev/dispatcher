import type { Locale } from '@dispatcher/i18n';
import type {
  AiReasonCode,
  EquipmentType,
  PolicyLimits,
  RateBounds,
} from '@dispatcher/shared';

/** Everything a strategy may look at. Floor/ceiling are hard limits enforced afterwards by the policy engine. */
export interface StrategyContext {
  /** Language for the carrier-facing rationale. */
  locale: Locale;
  currency: 'CAD' | 'USD';
  load: {
    originCity: string;
    originProvince: string;
    destinationCity: string;
    destinationProvince: string;
    pickupAt: Date;
    equipment: EquipmentType;
    weightKg: number;
    brokerName: string | null;
  };
  limits: PolicyLimits;
  bounds: RateBounds;
  /** Offer rounds already sent to the broker. */
  round: number;
  maxRounds: number;
  history: { actor: string; type: string; amount: number | null }[];
}

interface Explained {
  /** Deterministic explanation (rules strategy); clients translate it. */
  reasonCode: AiReasonCode | null;
  reasonParams?: Record<string, string | number>;
  /** Free-text explanation in the carrier's language (LLM strategy). */
  rationale: string | null;
  /** Professional English message for the broker. */
  brokerMessage: string;
  /** Audit metadata (model, effort, usage…). */
  meta?: Record<string, unknown>;
}

export interface OfferProposal extends Explained {
  amount: number;
}

export interface CounterDecision extends Explained {
  action: 'accept' | 'counter' | 'walk_away';
  /** Required when action = counter. */
  amount?: number;
}

/**
 * A negotiation strategy PROPOSES; it never decides alone. The service runs
 * every proposal through the policy engine (packages/shared/negotiation.ts)
 * before anything is sent. Implementations: RulesStrategy, ClaudeStrategy.
 */
export interface NegotiationStrategy {
  readonly name: 'claude' | 'rules';
  proposeOpening(ctx: StrategyContext): Promise<OfferProposal>;
  respondToCounter(
    ctx: StrategyContext,
    brokerOffer: number,
    lastOffer: number,
  ): Promise<CounterDecision>;
}

export const NEGOTIATION_STRATEGY = Symbol('NEGOTIATION_STRATEGY');
export const FALLBACK_STRATEGY = Symbol('FALLBACK_STRATEGY');
