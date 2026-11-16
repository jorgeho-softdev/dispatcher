import {
  nextTripStatus,
  tripCode,
  tripFinancials,
  type TripDetailDto,
  type TripDocumentDto,
  type TripDto,
} from '@dispatcher/shared';
import type { Prisma, TripDocument } from '../../generated/prisma/client';

export const TRIP_INCLUDE = {
  load: { include: { broker: true } },
  vehicle: true,
  expenses: { orderBy: { incurredAt: 'asc' } },
  documents: { orderBy: { createdAt: 'asc' } },
  brokerRating: true,
} satisfies Prisma.TripInclude;

export type TripWithRelations = Prisma.TripGetPayload<{
  include: typeof TRIP_INCLUDE;
}>;

export function toDocumentDto(d: TripDocument): TripDocumentDto {
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    createdAt: d.createdAt.toISOString(),
  };
}

export function toTripDto(t: TripWithRelations): TripDto {
  const rate = t.rate.toNumber();
  return {
    id: t.id,
    code: tripCode(t.sequence),
    status: t.status,
    nextStatus: nextTripStatus(t.status),
    negotiationId: t.negotiationId,
    load: {
      id: t.load.id,
      originCity: t.load.originCity,
      originProvince: t.load.originProvince,
      originLat: t.load.originLat,
      originLng: t.load.originLng,
      destinationCity: t.load.destinationCity,
      destinationProvince: t.load.destinationProvince,
      destinationLat: t.load.destinationLat,
      destinationLng: t.load.destinationLng,
      pickupAt: t.load.pickupAt.toISOString(),
      distanceKm: t.load.distanceKm.toNumber(),
      weightKg: t.load.weightKg,
      equipment: t.load.equipment,
      isSimulated: t.load.isSimulated,
      brokerName: t.load.broker?.name ?? null,
      // Simulated brokers have no phone on purpose: never dial a fake number.
      brokerPhone: t.load.broker?.phone ?? null,
    },
    vehicle: { id: t.vehicle.id, name: t.vehicle.name },
    plannedKm: t.plannedKm.toNumber(),
    lastPosition:
      t.lastLat !== null && t.lastLng !== null && t.lastAt
        ? { lat: t.lastLat, lng: t.lastLng, at: t.lastAt.toISOString() }
        : null,
    remainingKm: t.remainingKm?.toNumber() ?? null,
    etaAt: t.etaAt?.toISOString() ?? null,
    pickedUpAt: t.pickedUpAt?.toISOString() ?? null,
    deliveredAt: t.deliveredAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    hasPod: t.documents.some(
      (d) => d.type === 'pod' && d.status === 'uploaded',
    ),
    financials: tripFinancials({
      currency: t.currency,
      rate,
      plannedKm: t.plannedKm.toNumber(),
      costPerKm: t.costPerKm.toNumber(),
      expenses: t.expenses.map((e) => ({ amount: e.amount.toNumber() })),
    }),
    createdAt: t.createdAt.toISOString(),
  };
}

export function toTripDetailDto(t: TripWithRelations): TripDetailDto {
  return {
    ...toTripDto(t),
    documents: t.documents
      .filter((d) => d.status === 'uploaded')
      .map(toDocumentDto),
    expenses: t.expenses.map((e) => ({
      id: e.id,
      category: e.category,
      amount: e.amount.toNumber(),
      currency: e.currency,
      note: e.note,
      incurredAt: e.incurredAt.toISOString(),
    })),
    brokerRating: t.brokerRating
      ? { stars: t.brokerRating.stars, comment: t.brokerRating.comment }
      : null,
  };
}
