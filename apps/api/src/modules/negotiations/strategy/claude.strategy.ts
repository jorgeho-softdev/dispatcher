import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { LOCALE_INFO } from '@dispatcher/i18n';
import type { Env } from '../../../config/env';
import type {
  CounterDecision,
  NegotiationStrategy,
  OfferProposal,
  StrategyContext,
} from './negotiation-strategy';

// Stable system prompt (no per-request data) so it can be cached. The floor
// and ceiling are hard limits enforced in code anyway; the prompt only steers.
const SYSTEM_PROMPT = `You are the AI dispatcher of a Canadian owner-operator trucking company. You negotiate freight rates with brokers on the carrier's behalf.

How to negotiate:
- Maximize the carrier's rate while keeping the deal likely to close. Brokers in Western Canada usually move 3-12% above the posted rate.
- Every amount you propose must be within [floor, ceiling] from the context and rounded to the nearest 10. Never go below the floor or above the ceiling.
- Consider the empty kilometres (deadhead), the carrier's cost per km and how soon the pickup is.
- After the maximum number of rounds, either accept (only if the broker's offer is at or above the floor) or walk away politely.

Writing:
- "rationale": 1-2 short sentences for the carrier explaining your decision, written in the language named in the context. Mention concrete numbers.
- "brokerMessage": a short, professional message to the broker in English. Never reveal the carrier's costs, floor, ceiling or margin.`;

const OpeningSchema = z.object({
  offerAmount: z
    .number()
    .describe('Opening counter-offer to send to the broker'),
  rationale: z.string(),
  brokerMessage: z.string(),
});

const CounterSchema = z.object({
  action: z.enum(['accept', 'counter', 'walk_away']),
  counterAmount: z
    .number()
    .nullable()
    .describe('Required when action is "counter", otherwise null'),
  rationale: z.string(),
  brokerMessage: z.string(),
});

/** Thrown so the service falls back to the rules strategy (and audits why). */
export class StrategyUnavailableError extends Error {}

/**
 * Claude proposes the numbers and writes the explanations, via ONE structured
 * call per decision (workflow, not an open-ended agent). See
 * docs/adr/0013-ai-agent-architecture.md.
 */
@Injectable()
export class ClaudeStrategy implements NegotiationStrategy {
  readonly name = 'claude' as const;
  private readonly logger = new Logger(ClaudeStrategy.name);
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly effort: Env['AI_EFFORT'];

  constructor(config: ConfigService<Env, true>) {
    // Credentials resolve from ANTHROPIC_API_KEY (or the SDK's standard chain).
    this.client = new Anthropic({ timeout: 60_000, maxRetries: 2 });
    this.model = config.get('AI_MODEL', { infer: true });
    this.effort = config.get('AI_EFFORT', { infer: true });
  }

  async proposeOpening(ctx: StrategyContext): Promise<OfferProposal> {
    const out = await this.call(
      OpeningSchema,
      ctx,
      'Propose the opening counter-offer for this load.',
    );
    return {
      amount: out.parsed.offerAmount,
      reasonCode: null,
      rationale: out.parsed.rationale,
      brokerMessage: out.parsed.brokerMessage,
      meta: out.meta,
    };
  }

  async respondToCounter(
    ctx: StrategyContext,
    brokerOffer: number,
    lastOffer: number,
  ): Promise<CounterDecision> {
    const out = await this.call(
      CounterSchema,
      ctx,
      `The broker countered our offer of ${lastOffer} with ${brokerOffer}. Decide: accept, counter, or walk away.`,
    );
    return {
      action: out.parsed.action,
      amount: out.parsed.counterAmount ?? undefined,
      reasonCode: null,
      rationale: out.parsed.rationale,
      brokerMessage: out.parsed.brokerMessage,
      meta: out.meta,
    };
  }

  private async call<S extends z.ZodType>(
    schema: S,
    ctx: StrategyContext,
    task: string,
  ) {
    const context = {
      language: LOCALE_INFO[ctx.locale].englishName,
      currency: ctx.currency,
      load: { ...ctx.load, pickupAt: ctx.load.pickupAt.toISOString() },
      postedRate: ctx.limits.postedRate,
      loadedKm: ctx.limits.distanceKm,
      deadheadKm: ctx.limits.deadheadKm,
      costPerKm: ctx.limits.costPerKm,
      floor: ctx.bounds.floor,
      ceiling: ctx.bounds.ceiling,
      round: ctx.round,
      maxRounds: ctx.maxRounds,
      history: ctx.history,
      now: new Date().toISOString(),
    };

    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 16000,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `${task}\n\nContext (JSON):\n${JSON.stringify(context)}`,
          },
        ],
        output_config: {
          effort: this.effort,
          format: betaZodOutputFormat(schema),
        },
        // On a safety refusal the API retries on a fallback model server-side.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        this.logger.warn(`Claude API error ${error.status}: ${error.message}`);
        throw new StrategyUnavailableError(
          `anthropic_${error.status ?? 'error'}`,
        );
      }
      throw new StrategyUnavailableError('anthropic_unreachable');
    }

    if (response.stop_reason === 'refusal')
      throw new StrategyUnavailableError('refusal');
    if (!response.parsed_output)
      throw new StrategyUnavailableError('unparseable_output');

    return {
      parsed: response.parsed_output as z.infer<S>,
      meta: {
        model: response.model,
        effort: this.effort,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    };
  }
}
