import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ACTIVE_TRIP_STATUSES,
  MAX_UPLOAD_BYTES,
  canCompleteTrip,
  canTripTransition,
  estimateEta,
  tripCode,
  type BrokerRatingInput,
  type DownloadUrlDto,
  type ExpenseCreateInput,
  type FleetLiveDto,
  type TripDriverInput,
  type TripDetailDto,
  type TripDto,
  type TripListQuery,
  type TripLocationsInput,
  type TripStatus,
  type TripStatusUpdateInput,
  type UploadRequestInput,
  type UploadUrlDto,
} from '@dispatcher/shared';
import { apiError } from '../../common/api-error';
import type { AuthContext } from '../../common/auth-context';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma, Trip } from '../../generated/prisma/client';
import { StorageService } from '../storage/storage.service';
import { renderRateConfirmation } from './rate-confirmation.pdf';
import {
  TRIP_INCLUDE,
  toDocumentDto,
  toTripDetailDto,
  toTripDto,
  type TripWithRelations,
} from './trips.mapper';

const EQUIPMENT_EN: Record<string, string> = {
  cargo_van: 'Cargo van',
  sprinter: 'Sprinter',
  box_truck: 'Box truck',
  dry_van: 'Dry van',
  reefer: 'Reefer',
  flatbed: 'Flatbed',
};

/** Storage-safe file name (keeps the extension; no path tricks). */
const safeName = (name: string) =>
  name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80) || 'file';

/**
 * Trip lifecycle (docs/trips.md): created when a negotiation is booked,
 * progressed by the driver (status, GPS, documents, expenses) and closed
 * with a POD, which freezes the real profit.
 */
@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Idempotent: called by the negotiation workflow when a booking is confirmed. */
  async createFromNegotiation(negotiationId: string): Promise<Trip> {
    const existing = await this.prisma.trip.findUnique({
      where: { negotiationId },
    });
    if (existing) return existing;

    const n = await this.prisma.negotiation.findUniqueOrThrow({
      where: { id: negotiationId },
      include: { load: true },
    });
    const trip = await this.prisma.trip.create({
      data: {
        organizationId: n.organizationId,
        negotiationId: n.id,
        loadId: n.loadId,
        vehicleId: n.vehicleId,
        driverId: n.createdById,
        currency: n.currency,
        rate: n.agreedRate ?? n.postedRate,
        plannedKm: n.load.distanceKm.toNumber() + n.deadheadKm.toNumber(),
        costPerKm: n.costPerKm,
      },
    });
    // A storage outage must not undo a confirmed booking; the RC can be regenerated.
    await this.generateRateConfirmation(trip.id).catch((error: unknown) =>
      this.logger.warn(
        `Rate confirmation for ${trip.id} failed: ${String(error)}`,
      ),
    );
    return trip;
  }

  /** Drivers only ever see the trips assigned to them. */
  private scope(auth: AuthContext): Prisma.TripWhereInput {
    return {
      organizationId: auth.organizationId,
      ...(auth.role === 'driver' && { driverId: auth.userId }),
    };
  }

  async list(auth: AuthContext, query: TripListQuery): Promise<TripDto[]> {
    const status: Prisma.TripWhereInput['status'] =
      query.filter === 'active'
        ? { in: [...ACTIVE_TRIP_STATUSES] }
        : query.filter === 'completed'
          ? 'completed'
          : undefined;
    const trips = await this.prisma.trip.findMany({
      where: { ...this.scope(auth), ...(status && { status }) },
      include: TRIP_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }],
      take: query.limit,
    });
    return trips.map(toTripDto);
  }

  async get(auth: AuthContext, id: string): Promise<TripDetailDto> {
    return toTripDetailDto(await this.findOwned(auth, id));
  }

  /** Reassigns the trip to another member of the organization (Phase 4). */
  async assignDriver(
    auth: AuthContext,
    id: string,
    input: TripDriverInput,
  ): Promise<TripDetailDto> {
    const trip = await this.findOwned(auth, id);
    if (!ACTIVE_TRIP_STATUSES.includes(trip.status))
      throw this.invalidState(trip);
    const member = await this.prisma.membership.findFirst({
      where: { organizationId: auth.organizationId, userId: input.driverId },
    });
    if (!member)
      throw new NotFoundException(apiError('NOT_FOUND', 'Member not found'));
    await this.prisma.trip.update({
      where: { id: trip.id },
      data: { driverId: input.driverId },
    });
    return this.get(auth, id);
  }

  /** Live map (web): active trips with their last GPS fix + every vehicle's position. */
  async liveMap(auth: AuthContext): Promise<FleetLiveDto> {
    const [trips, vehicles] = await Promise.all([
      this.prisma.trip.findMany({
        where: {
          ...this.scope(auth),
          status: { in: [...ACTIVE_TRIP_STATUSES] },
        },
        include: { load: true, vehicle: true, driver: true },
        orderBy: { updatedAt: 'desc' },
      }),
      auth.role === 'driver'
        ? Promise.resolve([])
        : this.prisma.vehicle.findMany({
            where: { organizationId: auth.organizationId, deletedAt: null },
          }),
    ]);
    const onTrip = new Set(trips.map((t) => t.vehicleId));
    return {
      trips: trips.map((t) => ({
        id: t.id,
        code: tripCode(t.sequence),
        status: t.status,
        driverName: t.driver.name,
        vehicleName: t.vehicle.name,
        origin: {
          city: t.load.originCity,
          lat: t.load.originLat,
          lng: t.load.originLng,
        },
        destination: {
          city: t.load.destinationCity,
          lat: t.load.destinationLat,
          lng: t.load.destinationLng,
        },
        lastPosition:
          t.lastLat !== null && t.lastLng !== null && t.lastAt
            ? { lat: t.lastLat, lng: t.lastLng, at: t.lastAt.toISOString() }
            : null,
        etaAt: t.etaAt?.toISOString() ?? null,
        remainingKm: t.remainingKm?.toNumber() ?? null,
      })),
      vehicles: vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        equipment: v.equipment,
        position:
          v.lastLat !== null && v.lastLng !== null
            ? {
                lat: v.lastLat,
                lng: v.lastLng,
                source: 'gps' as const,
                at: v.lastLocationAt?.toISOString() ?? null,
              }
            : v.homeBaseLat !== null && v.homeBaseLng !== null
              ? {
                  lat: v.homeBaseLat,
                  lng: v.homeBaseLng,
                  source: 'home_base' as const,
                  at: null,
                }
              : null,
        onTrip: onTrip.has(v.id),
      })),
    };
  }

  /** Driver progress: Recogida → En ruta → Entrega (strict order). */
  async updateStatus(
    auth: AuthContext,
    id: string,
    input: TripStatusUpdateInput,
  ): Promise<TripDetailDto> {
    const trip = await this.findOwned(auth, id);
    const now = new Date();
    const data: Prisma.TripUpdateManyMutationInput = {
      ...(input.status === 'in_transit' && { pickedUpAt: now }),
      ...(input.status === 'delivered' && {
        deliveredAt: now,
        remainingKm: 0,
        etaAt: now,
      }),
    };
    await this.transition(trip, trip.status, input.status, data);
    return this.get(auth, id);
  }

  /**
   * Batched GPS fixes from the driver app. Keeps the latest position, the
   * remaining km and the ETA (to the pickup before loading, to the
   * destination after), and refreshes the vehicle's last location.
   */
  async recordLocations(
    auth: AuthContext,
    id: string,
    input: TripLocationsInput,
  ): Promise<TripDto> {
    const trip = await this.findOwned(auth, id);
    if (!['scheduled', 'at_pickup', 'in_transit'].includes(trip.status))
      throw this.invalidState(trip);

    const points = [...input.points].sort(
      (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
    );
    const latest = points[points.length - 1];
    const target =
      trip.status === 'in_transit'
        ? { lat: trip.load.destinationLat, lng: trip.load.destinationLng }
        : { lat: trip.load.originLat, lng: trip.load.originLng };
    const eta = estimateEta(latest, target, new Date(), latest.speedKmh);

    await this.prisma.$transaction([
      this.prisma.tripLocation.createMany({
        data: points.map((p) => ({
          tripId: trip.id,
          lat: p.lat,
          lng: p.lng,
          speedKmh: p.speedKmh,
          recordedAt: p.recordedAt,
        })),
      }),
      this.prisma.trip.update({
        where: { id: trip.id },
        data: {
          lastLat: latest.lat,
          lastLng: latest.lng,
          lastSpeedKmh: latest.speedKmh ?? null,
          lastAt: latest.recordedAt,
          remainingKm: eta.remainingKm,
          etaAt: eta.etaAt,
        },
      }),
      this.prisma.vehicle.update({
        where: { id: trip.vehicleId },
        data: {
          lastLat: latest.lat,
          lastLng: latest.lng,
          lastLocationAt: latest.recordedAt,
        },
      }),
    ]);
    return toTripDto(await this.findOwned(auth, id));
  }

  // ── Documents ─────────────────────────────────────────────────────────

  /** Step 1/2: reserve a document and return a presigned PUT URL. */
  async requestUpload(
    auth: AuthContext,
    id: string,
    input: UploadRequestInput,
  ): Promise<UploadUrlDto> {
    const trip = await this.findOwned(auth, id);
    if (trip.status === 'cancelled') throw this.invalidState(trip);
    const docId = randomUUID();
    const key = `org/${trip.organizationId}/trips/${trip.id}/${docId}/${safeName(input.fileName)}`;
    const doc = await this.prisma.tripDocument.create({
      data: {
        id: docId,
        tripId: trip.id,
        type: input.type,
        storageKey: key,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedById: auth.userId,
      },
    });
    const signed = await this.storage.presignUpload(key, input.mimeType);
    return {
      document: toDocumentDto(doc),
      uploadUrl: signed.url,
      method: 'PUT',
      headers: signed.headers,
      expiresAt: signed.expiresAt.toISOString(),
    };
  }

  /** Step 2/2: verify the object really landed in storage before trusting it. */
  async completeUpload(
    auth: AuthContext,
    id: string,
    documentId: string,
  ): Promise<TripDetailDto> {
    const trip = await this.findOwned(auth, id);
    const doc = await this.prisma.tripDocument.findFirst({
      where: { id: documentId, tripId: trip.id },
    });
    if (!doc)
      throw new NotFoundException(apiError('NOT_FOUND', 'Document not found'));
    if (doc.status === 'pending') {
      const object = await this.storage.head(doc.storageKey);
      if (!object || object.size === 0 || object.size > MAX_UPLOAD_BYTES) {
        throw new BadRequestException(
          apiError('UPLOAD_NOT_FOUND', 'File not found in storage'),
        );
      }
      await this.prisma.tripDocument.update({
        where: { id: doc.id },
        data: {
          status: 'uploaded',
          sizeBytes: object.size,
          uploadedAt: new Date(),
        },
      });
    }
    return this.get(auth, id);
  }

  async downloadUrl(
    auth: AuthContext,
    documentId: string,
  ): Promise<DownloadUrlDto> {
    const doc = await this.prisma.tripDocument.findFirst({
      where: { id: documentId, status: 'uploaded', trip: this.scope(auth) },
    });
    if (!doc)
      throw new NotFoundException(apiError('NOT_FOUND', 'Document not found'));
    const signed = await this.storage.presignDownload(
      doc.storageKey,
      doc.fileName,
    );
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }

  /** (Re)generates the Rate Confirmation PDF from the agreed negotiation. */
  async generateRateConfirmation(tripId: string): Promise<void> {
    const trip = await this.prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: { load: { include: { broker: true } }, organization: true },
    });
    const code = tripCode(trip.sequence);
    const pdf = await renderRateConfirmation({
      tripCode: code,
      isSimulated: trip.load.isSimulated,
      carrierName: trip.organization.name,
      brokerName: trip.load.broker?.name ?? '—',
      origin: `${trip.load.originCity}, ${trip.load.originProvince}`,
      destination: `${trip.load.destinationCity}, ${trip.load.destinationProvince}`,
      pickupAt: trip.load.pickupAt,
      equipment: EQUIPMENT_EN[trip.load.equipment] ?? trip.load.equipment,
      weightKg: trip.load.weightKg,
      distanceKm: trip.load.distanceKm.toNumber(),
      rate: trip.rate.toNumber(),
      currency: trip.currency,
      bookedAt: trip.createdAt,
      reference: trip.negotiationId ?? trip.id,
    });
    const docId = randomUUID();
    const key = `org/${trip.organizationId}/trips/${trip.id}/${docId}/rate-confirmation-${code}.pdf`;
    await this.storage.put(key, pdf, 'application/pdf');
    await this.prisma.tripDocument.create({
      data: {
        id: docId,
        tripId: trip.id,
        type: 'rate_confirmation',
        status: 'uploaded',
        storageKey: key,
        fileName: `rate-confirmation-${code}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: pdf.length,
        uploadedAt: new Date(),
      },
    });
  }

  // ── Expenses & close-out ──────────────────────────────────────────────

  async addExpense(
    auth: AuthContext,
    id: string,
    input: ExpenseCreateInput,
  ): Promise<TripDetailDto> {
    const trip = await this.findOwned(auth, id);
    // Real profit is frozen once the trip is closed.
    if (trip.status === 'completed' || trip.status === 'cancelled')
      throw this.invalidState(trip);
    await this.prisma.tripExpense.create({
      data: {
        tripId: trip.id,
        category: input.category,
        amount: input.amount,
        currency: trip.currency,
        note: input.note,
        incurredAt: input.incurredAt ?? new Date(),
        createdById: auth.userId,
      },
    });
    return this.get(auth, id);
  }

  async deleteExpense(
    auth: AuthContext,
    id: string,
    expenseId: string,
  ): Promise<TripDetailDto> {
    const trip = await this.findOwned(auth, id);
    if (trip.status === 'completed' || trip.status === 'cancelled')
      throw this.invalidState(trip);
    const res = await this.prisma.tripExpense.deleteMany({
      where: { id: expenseId, tripId: trip.id },
    });
    if (res.count === 0)
      throw new NotFoundException(apiError('NOT_FOUND', 'Expense not found'));
    return this.get(auth, id);
  }

  /** Closes the trip. Requires delivery + an uploaded POD. */
  async complete(auth: AuthContext, id: string): Promise<TripDetailDto> {
    const trip = await this.findOwned(auth, id);
    const hasPod = trip.documents.some(
      (d) => d.type === 'pod' && d.status === 'uploaded',
    );
    if (trip.status === 'delivered' && !hasPod) {
      throw new BadRequestException(
        apiError('POD_REQUIRED', 'Upload the proof of delivery first'),
      );
    }
    if (!canCompleteTrip(trip.status, hasPod)) throw this.invalidState(trip);
    await this.transition(trip, 'delivered', 'completed', {
      completedAt: new Date(),
    });
    return this.get(auth, id);
  }

  /** Before loading only. Releases the load back to the marketplace. */
  async cancel(auth: AuthContext, id: string): Promise<TripDetailDto> {
    const trip = await this.findOwned(auth, id);
    if (!canTripTransition(trip.status, 'cancelled'))
      throw this.invalidState(trip);
    await this.transition(trip, trip.status, 'cancelled', {
      cancelledAt: new Date(),
    });
    await this.prisma.load.updateMany({
      where: {
        id: trip.loadId,
        status: 'booked',
        pickupAt: { gt: new Date() },
      },
      data: { status: 'available' },
    });
    return this.get(auth, id);
  }

  /** One rating per trip; keeps the broker's average up to date. */
  async rateBroker(
    auth: AuthContext,
    id: string,
    input: BrokerRatingInput,
  ): Promise<TripDetailDto> {
    const trip = await this.findOwned(auth, id);
    if (!['delivered', 'completed'].includes(trip.status))
      throw this.invalidState(trip);
    const brokerId = trip.load.brokerId;
    if (!brokerId)
      throw new BadRequestException(
        apiError('VALIDATION_FAILED', 'Load has no broker'),
      );
    if (trip.brokerRating)
      throw new ConflictException(
        apiError('BROKER_ALREADY_RATED', 'Broker already rated'),
      );

    await this.prisma.$transaction(async (tx) => {
      await tx.brokerRating.create({
        data: {
          tripId: trip.id,
          brokerId,
          stars: input.stars,
          comment: input.comment,
        },
      });
      const avg = await tx.brokerRating.aggregate({
        where: { brokerId },
        _avg: { stars: true },
      });
      await tx.broker.update({
        where: { id: brokerId },
        data: { ratingAvg: avg._avg.stars ?? input.stars },
      });
    });
    return this.get(auth, id);
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private async transition(
    trip: Trip,
    from: TripStatus,
    to: TripStatus,
    data: Prisma.TripUpdateManyMutationInput = {},
  ) {
    if (!canTripTransition(from, to)) throw this.invalidState(trip);
    const res = await this.prisma.trip.updateMany({
      where: { id: trip.id, status: from },
      data: { ...data, status: to },
    });
    if (res.count === 0) throw this.invalidState(trip);
  }

  private async findOwned(
    auth: AuthContext,
    id: string,
  ): Promise<TripWithRelations> {
    const trip = await this.prisma.trip.findFirst({
      where: { id, ...this.scope(auth) },
      include: TRIP_INCLUDE,
    });
    if (!trip)
      throw new NotFoundException(apiError('NOT_FOUND', 'Trip not found'));
    return trip;
  }

  private invalidState(trip: Trip) {
    return new ConflictException(
      apiError('TRIP_INVALID_STATE', `Trip is ${trip.status}`),
    );
  }
}
