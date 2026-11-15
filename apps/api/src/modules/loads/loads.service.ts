import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  estimateRoadKm,
  findCity,
  scoreMatch,
  type LatLng,
  type LoadCreateInput,
  type LoadDetailDto,
  type LoadDetailQuery,
  type LoadDto,
  type LoadListDto,
  type LoadQuery,
  type MatchContextDto,
} from '@dispatcher/shared';
import { apiError } from '../../common/api-error';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, type Broker, type Load } from '../../generated/prisma/client';
import {
  MatchingContextService,
  type MatchContext,
} from './matching-context.service';

type LoadWithBroker = Load & { broker: Broker | null };

/**
 * Upper bound of loads scored per request. Matching is computed in the api
 * (explainable, testable), so views are ranked in memory over this candidate
 * set and paginated by offset. When volume grows, scores move to a
 * precomputed `load_matches` table (see docs/adr/0012-matching-and-geo.md).
 */
const MAX_CANDIDATES = 500;

const encodeCursor = (offset: number) =>
  Buffer.from(String(offset)).toString('base64url');
const decodeCursor = (cursor?: string) => {
  const n = cursor ? Number(Buffer.from(cursor, 'base64url').toString()) : 0;
  return Number.isInteger(n) && n >= 0 ? n : 0;
};

@Injectable()
export class LoadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingContextService,
  ) {}

  /**
   * Marketplace loads (organizationId null) plus the caller's own manual
   * loads, scored against the vehicle. Views:
   *  - recommended: compatible loads by match score
   *  - nearby:      loads within `radiusKm` of the position, closest first (PostGIS)
   *  - all:         every available load by pickup time
   */
  async list(
    organizationId: string,
    query: LoadQuery,
    now = new Date(),
  ): Promise<LoadListDto> {
    const ctx = await this.matching.resolve(organizationId, query, now);
    const where: Prisma.LoadWhereInput = {
      OR: [{ organizationId: null }, { organizationId }],
      status: query.status ?? 'available',
      ...(query.equipment && { equipment: query.equipment }),
      ...(query.originProvince && { originProvince: query.originProvince }),
      ...(!query.includeSimulated && { isSimulated: false }),
      ...(query.view !== 'all' && { pickupAt: { gte: now } }),
    };

    let loads: LoadWithBroker[];
    if (query.view === 'nearby') {
      if (!ctx.position)
        return { items: [], nextCursor: null, context: this.contextDto(ctx) };
      const nearIds = await this.idsWithinRadius(ctx.position, query.radiusKm);
      const rows = await this.prisma.load.findMany({
        where: { ...where, id: { in: nearIds } },
        include: { broker: true },
      });
      const order = new Map(nearIds.map((id, i) => [id, i]));
      loads = rows.sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      );
    } else {
      loads = await this.prisma.load.findMany({
        where,
        include: { broker: true },
        orderBy: [{ pickupAt: 'asc' }, { id: 'asc' }],
        take: MAX_CANDIDATES,
      });
    }

    let items = loads.map((l) => this.toDto(l, ctx, now));
    if (query.view === 'recommended') {
      items = items
        .filter((l) => l.match?.compatible)
        .sort(
          (a, b) =>
            (b.match?.score ?? 0) - (a.match?.score ?? 0) ||
            a.pickupAt.localeCompare(b.pickupAt),
        );
    }

    const offset = decodeCursor(query.cursor);
    const page = items.slice(offset, offset + query.limit);
    const next = offset + query.limit;
    return {
      items: page,
      nextCursor: next < items.length ? encodeCursor(next) : null,
      context: this.contextDto(ctx),
    };
  }

  async get(
    organizationId: string,
    id: string,
    query: LoadDetailQuery,
    now = new Date(),
  ): Promise<LoadDetailDto> {
    const [load, ctx] = await Promise.all([
      this.prisma.load.findFirst({
        where: { id, OR: [{ organizationId: null }, { organizationId }] },
        include: { broker: true },
      }),
      this.matching.resolve(organizationId, query, now),
    ]);
    if (!load)
      throw new NotFoundException(apiError('NOT_FOUND', 'Load not found'));

    const dto = this.toDto(load, ctx, now);
    const costPerKm = ctx.vehicle?.costPerKm.toNumber();
    const deadheadKm = dto.deadheadKm ?? 0;
    return {
      ...dto,
      notes: load.notes,
      context: this.contextDto(ctx),
      breakdown:
        costPerKm === undefined ||
        dto.estimatedProfit === null ||
        dto.marginPct === null
          ? null
          : {
              loadedKm: dto.distanceKm,
              deadheadKm,
              totalKm: Math.round((dto.distanceKm + deadheadKm) * 10) / 10,
              costPerKm,
              costs:
                Math.round((dto.postedRate - dto.estimatedProfit) * 100) / 100,
              profit: dto.estimatedProfit,
              marginPct: dto.marginPct,
            },
    };
  }

  /** Manual load entered by the carrier; private to their organization. */
  async createManual(
    organizationId: string,
    input: LoadCreateInput,
  ): Promise<LoadDetailDto> {
    const origin = this.resolvePoint(
      'origin',
      input.originCity,
      input.originProvince,
      input.originLat,
      input.originLng,
    );
    const destination = this.resolvePoint(
      'destination',
      input.destinationCity,
      input.destinationProvince,
      input.destinationLat,
      input.destinationLng,
    );
    const load = await this.prisma.load.create({
      data: {
        ...input,
        originLat: origin.lat,
        originLng: origin.lng,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        distanceKm: input.distanceKm ?? estimateRoadKm(origin, destination),
        source: 'manual',
        isSimulated: false,
        organizationId,
      },
    });
    return this.get(organizationId, load.id, {});
  }

  private resolvePoint(
    field: string,
    city: string,
    province: string,
    lat?: number,
    lng?: number,
  ): LatLng {
    if (lat !== undefined && lng !== undefined) return { lat, lng };
    const found = findCity(city, province);
    if (found) return found;
    throw new BadRequestException({
      ...apiError('VALIDATION_FAILED', `Unknown city ${city}, ${province}`),
      issues: [
        { path: `${field}City`, message: 'Unknown city; send coordinates' },
      ],
    });
  }

  /** Load ids whose pickup is within `radiusKm` (straight line), closest first. Uses the GiST index. */
  private async idsWithinRadius(
    position: LatLng,
    radiusKm: number,
  ): Promise<string[]> {
    const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${position.lng}, ${position.lat}), 4326)::geography`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM loads
      WHERE origin_geo IS NOT NULL AND ST_DWithin(origin_geo, ${point}, ${radiusKm * 1000})
      ORDER BY origin_geo <-> ${point}
      LIMIT ${MAX_CANDIDATES}`);
    return rows.map((r) => r.id);
  }

  private contextDto(ctx: MatchContext): MatchContextDto {
    return {
      vehicle: ctx.vehicle
        ? {
            id: ctx.vehicle.id,
            name: ctx.vehicle.name,
            equipment: ctx.vehicle.equipment,
            costPerKm: ctx.vehicle.costPerKm.toNumber(),
          }
        : null,
      positionSource: ctx.positionSource,
    };
  }

  private toDto(load: LoadWithBroker, ctx: MatchContext, now: Date): LoadDto {
    const postedRate = load.postedRate.toNumber();
    const distanceKm = load.distanceKm.toNumber();
    const deadheadKm = ctx.position
      ? estimateRoadKm(ctx.position, {
          lat: load.originLat,
          lng: load.originLng,
        })
      : null;

    const match = ctx.vehicle
      ? scoreMatch({
          load: {
            equipment: load.equipment,
            weightKg: load.weightKg,
            postedRate,
            distanceKm,
            pickupAt: load.pickupAt,
            originProvince: load.originProvince,
            destinationProvince: load.destinationProvince,
          },
          vehicle: {
            equipment: ctx.vehicle.equipment,
            capacityKg: ctx.vehicle.capacityKg,
            costPerKm: ctx.vehicle.costPerKm.toNumber(),
          },
          deadheadKm,
          preferences: ctx.preferences,
          now,
        })
      : null;

    return {
      id: load.id,
      source: load.source,
      isSimulated: load.isSimulated,
      status: load.status,
      originCity: load.originCity,
      originProvince: load.originProvince,
      destinationCity: load.destinationCity,
      destinationProvince: load.destinationProvince,
      pickupAt: load.pickupAt.toISOString(),
      distanceKm,
      weightKg: load.weightKg,
      equipment: load.equipment,
      postedRate,
      currency: load.currency,
      broker: load.broker
        ? {
            id: load.broker.id,
            name: load.broker.name,
            ratingAvg: load.broker.ratingAvg?.toNumber() ?? null,
          }
        : null,
      ratePerKm:
        distanceKm > 0 ? Math.round((postedRate / distanceKm) * 100) / 100 : 0,
      deadheadKm,
      estimatedProfit: match?.profit ?? null,
      marginPct: match?.marginPct ?? null,
      match: match
        ? {
            score: match.score,
            compatible: match.compatible,
            reasons: match.reasons,
          }
        : null,
    };
  }
}
