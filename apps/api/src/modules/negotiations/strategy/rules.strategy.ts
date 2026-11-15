import { Injectable } from '@nestjs/common';
import { brokerOfferAcceptable, roundRate } from '@dispatcher/shared';
import type {
  CounterDecision,
  NegotiationStrategy,
  OfferProposal,
  StrategyContext,
} from './negotiation-strategy';

const fmt = (n: number) =>
  n.toLocaleString('en-CA', { maximumFractionDigits: 0 });

/**
 * Deterministic negotiation strategy. Used when no LLM is configured, in
 * tests, and as the fallback when the LLM call fails or is refused.
 */
@Injectable()
export class RulesStrategy implements NegotiationStrategy {
  readonly name = 'rules' as const;

  /** Opening: ask for 60 % of the allowed markup over the posted rate. */
  proposeOpening(ctx: StrategyContext): Promise<OfferProposal> {
    const pct = Math.round(ctx.limits.maxCounterOfferPct * 0.6);
    const amount = roundRate(ctx.limits.postedRate * (1 + pct / 100));
    return Promise.resolve({
      amount,
      reasonCode: 'target_markup',
      reasonParams: { pct },
      rationale: null,
      brokerMessage: `Hi, we're interested in ${ctx.load.originCity} → ${ctx.load.destinationCity}. We can cover it at ${ctx.currency} ${fmt(amount)}. Can you make that work?`,
    });
  }

  /**
   * Accept when the counter is close to our last offer (≤3 %) and meets the
   * carrier's floor; otherwise split the difference until max rounds.
   */
  respondToCounter(
    ctx: StrategyContext,
    brokerOffer: number,
    lastOffer: number,
  ): Promise<CounterDecision> {
    const acceptable = brokerOfferAcceptable(brokerOffer, ctx.limits);
    const close = brokerOffer >= lastOffer * 0.97;
    const lastRound = ctx.round >= ctx.maxRounds;

    if (acceptable && (close || lastRound)) {
      return Promise.resolve({
        action: 'accept',
        reasonCode: 'accept_meets_minimums',
        rationale: null,
        brokerMessage: `${ctx.currency} ${fmt(brokerOffer)} works for us. Please confirm and send the rate confirmation.`,
      });
    }
    if (lastRound) {
      return Promise.resolve({
        action: 'walk_away',
        reasonCode: acceptable
          ? 'max_rounds_reached'
          : 'walk_away_below_minimums',
        rationale: null,
        brokerMessage: `Thanks for your time — we can't make ${ctx.currency} ${fmt(brokerOffer)} work on this one.`,
      });
    }
    const amount = roundRate((brokerOffer + lastOffer) / 2);
    return Promise.resolve({
      action: 'counter',
      amount,
      reasonCode: 'counter_midpoint',
      reasonParams: { broker: fmt(brokerOffer), last: fmt(lastOffer) },
      rationale: null,
      brokerMessage: `We're close. Can you meet us at ${ctx.currency} ${fmt(amount)}?`,
    });
  }
}
