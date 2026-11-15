import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { DEFAULT_LOCALE, isLocale } from '@dispatcher/i18n';
import {
  MAX_NEGOTIATION_ROUNDS,
  TERMINAL_STATUSES,
  brokerOfferAcceptable,
  canTransition,
  checkOffer,
  estimateRoadKm,
  rateBounds,
  requiresApproval,
  type AdjustOfferInput,
  type NegotiationDetailDto,
  type NegotiationDto,
  type NegotiationListQuery,
  type NegotiationStatus,
  type PolicyLimits,
  type StartNegotiationInput,
} from '@dispatcher/shared';
import { apiError } from '../../common/api-error';
import type { AuthContext } from '../../common/auth-context';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, type Negotiation } from '../../generated/prisma/client';
import { MatchingContextService } from '../loads/matching-context.service';
import { PushService, type PushTemplate } from '../notifications/push.service';
import {
  BROKER_CHANNEL,
  type BrokerChannel,
  type BrokerResponse,
} from './broker/broker-channel';
import { StrategyUnavailableError } from './strategy/claude.strategy';
import {
  FALLBACK_STRATEGY,
  NEGOTIATION_STRATEGY,
  type CounterDecision,
  type NegotiationStrategy,
  type OfferProposal,
  type StrategyContext,
} from './strategy/negotiation-strategy';
import { JOB_OPTIONS, NEGOTIATIONS_QUEUE } from './negotiations.queue';
import {
  NEGOTIATION_INCLUDE,
  toNegotiationDetailDto,
  toNegotiationDto,
  type NegotiationWithRelations,
} from './negotiations.mapper';

type EventInput = Omit<
  Prisma.NegotiationEventUncheckedCreateInput,
  'negotiationId'
>;

const num = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

/**
 * Orchestrates the AI-assisted negotiation workflow (docs/ai-agent.md):
 *
 *   start ─► ai_thinking ─(strategy + policy)─► awaiting_send_approval ─approve─┐
 *                     └──────────── semi_auto ───────────────────────────────────┤
 *                                                                               ▼
 *   booked ◄─ booking_requested ◄─approve─ awaiting_booking_approval ◄─ contacting_broker
 *                                                                  └─ counter ─► ai_thinking
 *
 * Every transition is atomic (conditional update on the current status), so
 * duplicated or late jobs are harmless. Every decision is audited as an event.
 */
@Injectable()
export class NegotiationsService {
  private readonly logger = new Logger(NegotiationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingContextService,
    private readonly push: PushService,
    @Inject(NEGOTIATION_STRATEGY)
    private readonly strategy: NegotiationStrategy,
    @Inject(FALLBACK_STRATEGY) private readonly fallback: NegotiationStrategy,
    @Inject(BROKER_CHANNEL) private readonly broker: BrokerChannel,
    @InjectQueue(NEGOTIATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  // ── Public API (controller) ───────────────────────────────────────────

  async start(
    auth: AuthContext,
    input: StartNegotiationInput,
  ): Promise<NegotiationDetailDto> {
    const load = await this.prisma.load.findFirst({
      where: {
        id: input.loadId,
        OR: [{ organizationId: null }, { organizationId: auth.organizationId }],
      },
    });
    if (!load)
      throw new NotFoundException(apiError('NOT_FOUND', 'Load not found'));
    if (load.status !== 'available' || load.pickupAt < new Date()) {
      throw new ConflictException(
        apiError('LOAD_UNAVAILABLE', 'Load is no longer available'),
      );
    }

    const active = await this.prisma.negotiation.findFirst({
      where: {
        organizationId: auth.organizationId,
        loadId: load.id,
        status: { notIn: [...TERMINAL_STATUSES] },
      },
    });
    if (active) {
      throw new ConflictException(
        apiError(
          'NEGOTIATION_ALREADY_ACTIVE',
          `Negotiation ${active.id} already active`,
        ),
      );
    }

    const [ctx, settings] = await Promise.all([
      this.matching.resolve(auth.organizationId, {
        vehicleId: input.vehicleId,
      }),
      this.prisma.aiSettings.upsert({
        where: { organizationId: auth.organizationId },
        create: { organizationId: auth.organizationId },
        update: {},
      }),
    ]);
    if (!ctx.vehicle)
      throw new BadRequestException(
        apiError('VEHICLE_REQUIRED', 'Add a vehicle first'),
      );

    const limits: PolicyLimits = {
      postedRate: load.postedRate.toNumber(),
      distanceKm: load.distanceKm.toNumber(),
      deadheadKm: ctx.position
        ? estimateRoadKm(ctx.position, {
            lat: load.originLat,
            lng: load.originLng,
          })
        : 0,
      costPerKm: ctx.vehicle.costPerKm.toNumber(),
      minRatePerKm: settings.minRatePerKm.toNumber(),
      minMarginPct: settings.minMarginPct.toNumber(),
      maxCounterOfferPct: settings.maxCounterOfferPct.toNumber(),
    };
    const bounds = rateBounds(limits);

    // Limits are snapshotted: editing preferences later doesn't change this negotiation.
    const negotiation = await this.prisma.negotiation.create({
      data: {
        organizationId: auth.organizationId,
        loadId: load.id,
        vehicleId: ctx.vehicle.id,
        createdById: auth.userId,
        status: 'ai_thinking',
        autonomyLevel: settings.autonomyLevel,
        strategy: this.strategy.name,
        currency: load.currency,
        postedRate: limits.postedRate,
        floorRate: bounds.floor,
        ceilingRate: bounds.ceiling,
        deadheadKm: limits.deadheadKm,
        costPerKm: limits.costPerKm,
        minRatePerKm: limits.minRatePerKm,
        minMarginPct: limits.minMarginPct,
        maxCounterPct: limits.maxCounterOfferPct,
      },
    });
    await this.enqueue('ai-propose', negotiation.id);
    return this.getDetail(auth.organizationId, negotiation.id);
  }

  async list(
    organizationId: string,
    query: NegotiationListQuery,
  ): Promise<NegotiationDto[]> {
    const status: Prisma.NegotiationWhereInput['status'] =
      query.filter === 'needs_approval'
        ? { in: ['awaiting_send_approval', 'awaiting_booking_approval'] }
        : query.filter === 'active'
          ? { notIn: [...TERMINAL_STATUSES] }
          : undefined;
    const rows = await this.prisma.negotiation.findMany({
      where: { organizationId, ...(status && { status }) },
      include: NEGOTIATION_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: query.limit,
    });
    return rows.map(toNegotiationDto);
  }

  async getDetail(
    organizationId: string,
    id: string,
  ): Promise<NegotiationDetailDto> {
    return toNegotiationDetailDto(await this.findOwned(organizationId, id));
  }

  async approveSend(
    auth: AuthContext,
    id: string,
  ): Promise<NegotiationDetailDto> {
    const n = await this.findOwned(auth.organizationId, id);
    this.assertStatus(n, 'awaiting_send_approval');
    await this.addEvent(n.id, {
      type: 'user_approved_send',
      actor: 'user',
      amount: n.currentOffer,
    });
    await this.sendOffer(n, 'awaiting_send_approval');
    return this.getDetail(auth.organizationId, id);
  }

  /** The carrier sets the offer manually; the policy engine still applies. */
  async adjustOffer(
    auth: AuthContext,
    id: string,
    input: AdjustOfferInput,
  ): Promise<NegotiationDetailDto> {
    const n = await this.findOwned(auth.organizationId, id);
    this.assertStatus(n, 'awaiting_send_approval');
    const decision = checkOffer(input.amount, this.limitsOf(n));
    if (!decision.ok) {
      throw new BadRequestException(
        apiError('VALIDATION_FAILED', 'Offer cannot meet the minimums'),
      );
    }
    await this.addEvent(n.id, {
      type: 'user_adjusted',
      actor: 'user',
      amount: input.amount,
    });
    if (decision.adjusted) {
      await this.addEvent(n.id, {
        type: 'policy_adjusted',
        actor: 'system',
        amount: decision.amount,
        reasonCode: decision.reason,
      });
    }
    await this.prisma.negotiation.update({
      where: { id: n.id },
      data: { currentOffer: decision.amount },
    });
    return this.getDetail(auth.organizationId, id);
  }

  async approveBooking(
    auth: AuthContext,
    id: string,
  ): Promise<NegotiationDetailDto> {
    const n = await this.findOwned(auth.organizationId, id);
    this.assertStatus(n, 'awaiting_booking_approval');
    if (
      !(await this.transition(
        n,
        'awaiting_booking_approval',
        'booking_requested',
      ))
    ) {
      throw this.invalidState(n);
    }
    await this.addEvent(n.id, {
      type: 'user_approved_booking',
      actor: 'user',
      amount: n.agreedRate,
    });
    await this.addEvent(n.id, {
      type: 'booking_requested',
      actor: 'system',
      amount: n.agreedRate,
    });
    await this.broker.requestBooking(this.ref(n), num(n.agreedRate) ?? 0);
    return this.getDetail(auth.organizationId, id);
  }

  async cancel(auth: AuthContext, id: string): Promise<NegotiationDetailDto> {
    const n = await this.findOwned(auth.organizationId, id);
    const cancellable: NegotiationStatus[] = [
      'ai_thinking',
      'awaiting_send_approval',
      'contacting_broker',
      'awaiting_booking_approval',
    ];
    if (
      !cancellable.includes(n.status) ||
      !(await this.transition(n, n.status, 'cancelled'))
    ) {
      throw this.invalidState(n);
    }
    await this.addEvent(n.id, { type: 'user_cancelled', actor: 'user' });
    return this.getDetail(auth.organizationId, id);
  }

  // ── Workflow steps (BullMQ processor) ─────────────────────────────────

  /** Job `ai-propose`: the strategy proposes the opening offer. */
  async runOpening(id: string): Promise<void> {
    const n = await this.prisma.negotiation.findUnique({
      where: { id },
      include: NEGOTIATION_INCLUDE,
    });
    if (!n || n.status !== 'ai_thinking' || n.round > 0) return; // idempotent

    const limits = this.limitsOf(n);
    if (!rateBounds(limits).viable) {
      await this.addEvent(n.id, {
        type: 'policy_blocked',
        actor: 'system',
        reasonCode: 'unprofitable_at_ceiling',
      });
      await this.finish(n, 'failed', 'failed');
      return;
    }

    const { result: proposal, strategy } = await this.withFallback((s) =>
      s.proposeOpening(this.context(n)),
    );
    const decision = checkOffer(proposal.amount, limits);
    if (!decision.ok) {
      await this.addEvent(n.id, {
        type: 'policy_blocked',
        actor: 'system',
        reasonCode: decision.reason,
      });
      await this.finish(n, 'failed', 'failed');
      return;
    }
    await this.addEvent(
      n.id,
      this.aiEvent('ai_proposed', proposal, proposal.amount, strategy),
    );
    if (decision.adjusted) {
      await this.addEvent(n.id, {
        type: 'policy_adjusted',
        actor: 'system',
        amount: decision.amount,
        reasonCode: decision.reason,
      });
    }
    await this.prisma.negotiation.update({
      where: { id: n.id },
      data: { currentOffer: decision.amount },
    });
    await this.afterOfferPrepared({
      ...n,
      currentOffer: new Prisma.Decimal(decision.amount),
    });
  }

  /** Job `ai-respond`: the strategy reacts to the broker's counter. */
  async runResponse(id: string): Promise<void> {
    const n = await this.prisma.negotiation.findUnique({
      where: { id },
      include: NEGOTIATION_INCLUDE,
    });
    if (!n || n.status !== 'ai_thinking' || n.round === 0) return; // idempotent

    const limits = this.limitsOf(n);
    const brokerOffer = num(n.brokerOffer) ?? 0;
    const lastOffer = num(n.currentOffer) ?? limits.postedRate;
    const { result, strategy } = await this.withFallback((s) =>
      s.respondToCounter(this.context(n), brokerOffer, lastOffer),
    );
    const decision = this.enforceCounterPolicy(
      result,
      n.round,
      brokerOffer,
      lastOffer,
      limits,
    );

    if (decision.action === 'accept') {
      await this.addEvent(
        n.id,
        this.aiEvent('ai_accepted', decision, brokerOffer, strategy),
      );
      if (
        await this.transition(n, 'ai_thinking', 'awaiting_booking_approval', {
          agreedRate: brokerOffer,
        })
      ) {
        await this.notify(n, 'bookingApproval', brokerOffer);
      }
      return;
    }
    if (decision.action === 'walk_away') {
      await this.addEvent(
        n.id,
        this.aiEvent('ai_walked_away', decision, brokerOffer, strategy),
      );
      await this.finish(n, 'rejected', 'rejected');
      return;
    }
    await this.addEvent(
      n.id,
      this.aiEvent('ai_countered', decision, decision.amount!, strategy),
    );
    await this.prisma.negotiation.update({
      where: { id: n.id },
      data: { currentOffer: decision.amount },
    });
    await this.afterOfferPrepared({
      ...n,
      currentOffer: new Prisma.Decimal(decision.amount!),
    });
  }

  /** Job `broker-response`: a reply from the broker channel. */
  async handleBrokerResponse(
    id: string,
    response: BrokerResponse,
  ): Promise<void> {
    const n = await this.prisma.negotiation.findUnique({
      where: { id },
      include: NEGOTIATION_INCLUDE,
    });
    if (!n) return;

    if (response.kind === 'booking') {
      if (n.status !== 'booking_requested') return;
      if (response.type === 'decline') {
        await this.addEvent(n.id, {
          type: 'booking_declined',
          actor: 'broker',
          brokerMessage: response.message,
        });
        await this.finish(n, 'failed', 'failed');
        return;
      }
      // The load can only be booked once, across all organizations.
      const claimed = await this.prisma.load.updateMany({
        where: { id: n.loadId, status: 'available' },
        data: { status: 'booked' },
      });
      if (claimed.count === 0) {
        await this.addEvent(n.id, {
          type: 'load_unavailable',
          actor: 'system',
        });
        await this.finish(n, 'failed', 'failed');
        return;
      }
      await this.addEvent(n.id, {
        type: 'booking_confirmed',
        actor: 'broker',
        amount: n.agreedRate,
        brokerMessage: response.message,
      });
      await this.finish(n, 'booked', 'booked');
      return;
    }

    if (n.status !== 'contacting_broker') return; // cancelled meanwhile, or duplicate job
    if (response.type === 'accept') {
      await this.addEvent(n.id, {
        type: 'broker_accepted',
        actor: 'broker',
        amount: response.amount,
        brokerMessage: response.message,
      });
      if (
        await this.transition(
          n,
          'contacting_broker',
          'awaiting_booking_approval',
          { agreedRate: response.amount },
        )
      ) {
        await this.notify(n, 'bookingApproval', response.amount);
      }
    } else if (response.type === 'counter') {
      await this.addEvent(n.id, {
        type: 'broker_countered',
        actor: 'broker',
        amount: response.amount,
        brokerMessage: response.message,
      });
      if (
        await this.transition(n, 'contacting_broker', 'ai_thinking', {
          brokerOffer: response.amount,
        })
      ) {
        await this.enqueue('ai-respond', n.id);
      }
    } else {
      await this.addEvent(n.id, {
        type: 'broker_rejected',
        actor: 'broker',
        brokerMessage: response.message,
      });
      await this.finish(n, 'rejected', 'rejected');
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /** Assisted mode waits for the carrier; semi-auto sends right away. */
  private async afterOfferPrepared(n: NegotiationWithRelations): Promise<void> {
    if (requiresApproval(n.autonomyLevel, 'send_offer')) {
      if (await this.transition(n, 'ai_thinking', 'awaiting_send_approval')) {
        await this.notify(n, 'sendApproval', num(n.currentOffer) ?? 0);
      }
      return;
    }
    await this.sendOffer(n, 'ai_thinking');
  }

  private async sendOffer(
    n: Negotiation,
    from: NegotiationStatus,
  ): Promise<void> {
    const load = await this.prisma.load.findUnique({ where: { id: n.loadId } });
    if (!load || load.status !== 'available') {
      await this.addEvent(n.id, { type: 'load_unavailable', actor: 'system' });
      await this.finish(n, 'failed', 'failed');
      return;
    }
    const round = n.round + 1;
    if (!(await this.transition(n, from, 'contacting_broker', { round })))
      throw this.invalidState(n);
    const amount = num(n.currentOffer) ?? 0;
    const lastAi = await this.prisma.negotiationEvent.findFirst({
      where: {
        negotiationId: n.id,
        type: { in: ['ai_proposed', 'ai_countered'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    const message =
      lastAi?.brokerMessage ?? `We can cover this load at ${amount}.`;
    await this.addEvent(n.id, {
      type: 'offer_sent',
      actor: 'system',
      amount,
      brokerMessage: message,
    });
    await this.broker.sendOffer({ ...this.ref(n), round }, amount, message);
  }

  /**
   * The policy engine has the last word over the strategy: accepts below the
   * floor become counters (or walk-aways), counters are clamped between the
   * broker's offer and our last offer, and rounds are capped.
   */
  private enforceCounterPolicy(
    d: CounterDecision,
    round: number,
    brokerOffer: number,
    lastOffer: number,
    limits: PolicyLimits,
  ): CounterDecision {
    const acceptable = brokerOfferAcceptable(brokerOffer, limits);
    if (d.action === 'accept') {
      return acceptable
        ? d
        : {
            ...d,
            action: round >= MAX_NEGOTIATION_ROUNDS ? 'walk_away' : 'counter',
            amount: lastOffer,
            reasonCode: 'walk_away_below_minimums',
          };
    }
    if (d.action === 'counter') {
      if (round >= MAX_NEGOTIATION_ROUNDS) {
        return acceptable
          ? { ...d, action: 'accept', reasonCode: 'max_rounds_reached' }
          : { ...d, action: 'walk_away', reasonCode: 'max_rounds_reached' };
      }
      const checked = checkOffer(d.amount ?? lastOffer, limits);
      const amount = checked.ok
        ? Math.min(lastOffer, Math.max(checked.amount, brokerOffer + 10))
        : lastOffer;
      return { ...d, amount };
    }
    return d;
  }

  /** Runs the configured strategy; on any failure falls back to the rules strategy. */
  private async withFallback<T>(
    fn: (s: NegotiationStrategy) => Promise<T>,
  ): Promise<{
    result: T;
    strategy: { name: string; fallbackReason?: string };
  }> {
    if (this.strategy === this.fallback)
      return {
        result: await fn(this.strategy),
        strategy: { name: this.strategy.name },
      };
    try {
      return {
        result: await fn(this.strategy),
        strategy: { name: this.strategy.name },
      };
    } catch (error) {
      const reason =
        error instanceof StrategyUnavailableError
          ? error.message
          : 'unexpected_error';
      if (!(error instanceof StrategyUnavailableError))
        this.logger.error(error);
      return {
        result: await fn(this.fallback),
        strategy: { name: this.fallback.name, fallbackReason: reason },
      };
    }
  }

  private aiEvent(
    type: 'ai_proposed' | 'ai_countered' | 'ai_accepted' | 'ai_walked_away',
    p: OfferProposal | CounterDecision,
    amount: number,
    strategy: { name: string; fallbackReason?: string },
  ): EventInput {
    return {
      type,
      actor: 'ai',
      amount,
      reasonCode: p.reasonCode,
      reasonParams: p.reasonParams ?? Prisma.JsonNull,
      rationale: p.rationale,
      brokerMessage: p.brokerMessage,
      payload: {
        strategy: strategy.name,
        ...(strategy.fallbackReason && {
          fallbackReason: strategy.fallbackReason,
        }),
        ...(p.meta ?? {}),
      },
    };
  }

  private context(n: NegotiationWithRelations): StrategyContext {
    const limits = this.limitsOf(n);
    return {
      locale: isLocale(n.createdBy.locale)
        ? n.createdBy.locale
        : DEFAULT_LOCALE,
      currency: n.currency,
      load: {
        originCity: n.load.originCity,
        originProvince: n.load.originProvince,
        destinationCity: n.load.destinationCity,
        destinationProvince: n.load.destinationProvince,
        pickupAt: n.load.pickupAt,
        equipment: n.load.equipment,
        weightKg: n.load.weightKg,
        brokerName: n.load.broker?.name ?? null,
      },
      limits,
      bounds: rateBounds(limits),
      round: n.round,
      maxRounds: MAX_NEGOTIATION_ROUNDS,
      history: n.events.map((e) => ({
        actor: e.actor,
        type: e.type,
        amount: num(e.amount),
      })),
    };
  }

  private limitsOf(
    n: Negotiation & { load?: { distanceKm: Prisma.Decimal } },
  ): PolicyLimits {
    return {
      postedRate: n.postedRate.toNumber(),
      distanceKm: n.load?.distanceKm.toNumber() ?? 0,
      deadheadKm: n.deadheadKm.toNumber(),
      costPerKm: n.costPerKm.toNumber(),
      minRatePerKm: n.minRatePerKm.toNumber(),
      minMarginPct: n.minMarginPct.toNumber(),
      maxCounterOfferPct: n.maxCounterPct.toNumber(),
    };
  }

  /** Atomic conditional transition; returns false if the status already moved on. */
  private async transition(
    n: Negotiation,
    from: NegotiationStatus,
    to: NegotiationStatus,
    data: Prisma.NegotiationUpdateManyMutationInput = {},
  ): Promise<boolean> {
    if (!canTransition(from, to))
      throw new Error(`Illegal transition ${from} → ${to}`);
    const res = await this.prisma.negotiation.updateMany({
      where: { id: n.id, status: from },
      data: { ...data, status: to },
    });
    return res.count === 1;
  }

  private async finish(
    n: Negotiation,
    to: 'booked' | 'rejected' | 'failed',
    template: PushTemplate,
  ): Promise<void> {
    const current = await this.prisma.negotiation.findUnique({
      where: { id: n.id },
    });
    if (!current || !canTransition(current.status, to)) return;
    if (await this.transition(current, current.status, to)) {
      await this.notify(
        n,
        template,
        num(current.agreedRate ?? current.currentOffer) ?? 0,
      );
    }
  }

  private async notify(n: Negotiation, template: PushTemplate, amount: number) {
    const load = await this.prisma.load.findUnique({ where: { id: n.loadId } });
    if (!load) return;
    await this.push.notifyUser(
      n.createdById,
      template,
      {
        route: `${load.originCity} → ${load.destinationCity}`,
        amount: `${n.currency === 'CAD' ? 'CA$' : 'US$'}${amount.toLocaleString('en-CA')}`,
      },
      { negotiationId: n.id },
    );
  }

  private addEvent(negotiationId: string, data: EventInput) {
    return this.prisma.negotiationEvent.create({
      data: { ...data, negotiationId },
    });
  }

  private enqueue(name: 'ai-propose' | 'ai-respond', negotiationId: string) {
    // Handlers check the current status, so a duplicated job is a no-op.
    return this.queue.add(name, { negotiationId }, JOB_OPTIONS);
  }

  private ref(n: Negotiation) {
    return {
      id: n.id,
      loadId: n.loadId,
      postedRate: n.postedRate.toNumber(),
      round: n.round,
    };
  }

  private async findOwned(
    organizationId: string,
    id: string,
  ): Promise<NegotiationWithRelations> {
    const n = await this.prisma.negotiation.findFirst({
      where: { id, organizationId },
      include: NEGOTIATION_INCLUDE,
    });
    if (!n)
      throw new NotFoundException(
        apiError('NOT_FOUND', 'Negotiation not found'),
      );
    return n;
  }

  private assertStatus(n: Negotiation, status: NegotiationStatus) {
    if (n.status !== status) throw this.invalidState(n);
  }

  private invalidState(n: Negotiation) {
    return new ConflictException(
      apiError('NEGOTIATION_INVALID_STATE', `Negotiation is ${n.status}`),
    );
  }
}
