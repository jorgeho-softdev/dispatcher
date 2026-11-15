import {
  allowedActions,
  estimateProfit,
  type AiReasonCode,
  type NegotiationDetailDto,
  type NegotiationDto,
  type NegotiationEventDto,
} from '@dispatcher/shared';
import type { Prisma } from '../../generated/prisma/client';

export const NEGOTIATION_INCLUDE = {
  load: { include: { broker: true } },
  createdBy: true,
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.NegotiationInclude;

export type NegotiationWithRelations = Prisma.NegotiationGetPayload<{
  include: typeof NEGOTIATION_INCLUDE;
}>;
type EventRow = NegotiationWithRelations['events'][number];

const num = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

function toEventDto(e: EventRow): NegotiationEventDto {
  return {
    id: e.id,
    type: e.type,
    actor: e.actor,
    amount: num(e.amount),
    reasonCode: (e.reasonCode as AiReasonCode | null) ?? null,
    reasonParams:
      (e.reasonParams as Record<string, string | number> | null) ?? null,
    rationale: e.rationale,
    brokerMessage: e.brokerMessage,
    createdAt: e.createdAt.toISOString(),
  };
}

export function toNegotiationDto(n: NegotiationWithRelations): NegotiationDto {
  const distanceKm = n.load.distanceKm.toNumber();
  const deadheadKm = n.deadheadKm.toNumber();
  const postedRate = n.postedRate.toNumber();
  const rate = num(n.agreedRate) ?? num(n.currentOffer) ?? postedRate;
  const estimate = estimateProfit({
    postedRate: rate,
    distanceKm,
    deadheadKm,
    costPerKm: n.costPerKm.toNumber(),
  });
  const latestAi = [...n.events].reverse().find((e) => e.actor === 'ai');

  return {
    id: n.id,
    status: n.status,
    autonomyLevel: n.autonomyLevel,
    strategy: n.strategy,
    load: {
      id: n.load.id,
      originCity: n.load.originCity,
      originProvince: n.load.originProvince,
      destinationCity: n.load.destinationCity,
      destinationProvince: n.load.destinationProvince,
      pickupAt: n.load.pickupAt.toISOString(),
      distanceKm,
      weightKg: n.load.weightKg,
      equipment: n.load.equipment,
      isSimulated: n.load.isSimulated,
      brokerName: n.load.broker?.name ?? null,
    },
    currency: n.currency,
    postedRate,
    currentOffer: num(n.currentOffer),
    brokerOffer: num(n.brokerOffer),
    agreedRate: num(n.agreedRate),
    round: n.round,
    floorRate: n.floorRate.toNumber(),
    ceilingRate: n.ceilingRate.toNumber(),
    deadheadKm,
    estimatedProfit: estimate.profit,
    marginPct: estimate.marginPct,
    allowedActions: allowedActions(n.status),
    latestAi: latestAi ? toEventDto(latestAi) : null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

export function toNegotiationDetailDto(
  n: NegotiationWithRelations,
): NegotiationDetailDto {
  return { ...toNegotiationDto(n), events: n.events.map(toEventDto) };
}
