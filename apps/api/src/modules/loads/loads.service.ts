import { apiError } from '../../common/api-error';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  estimateProfit,
  type LoadCreateInput,
  type LoadDto,
  type LoadQuery,
  type Paginated,
} from '@dispatcher/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  Broker,
  Load,
  Prisma,
  Vehicle,
} from '../../generated/prisma/client';

type LoadWithBroker = Load & { broker: Broker | null };

@Injectable()
export class LoadsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Marketplace loads (organizationId null) plus the caller's own manual loads. */
  async list(
    organizationId: string,
    query: LoadQuery,
  ): Promise<Paginated<LoadDto>> {
    const where: Prisma.LoadWhereInput = {
      OR: [{ organizationId: null }, { organizationId }],
      status: query.status ?? 'available',
      ...(query.equipment && { equipment: query.equipment }),
      ...(query.originProvince && { originProvince: query.originProvince }),
      ...(!query.includeSimulated && { isSimulated: false }),
    };

    const [rows, vehicles] = await Promise.all([
      this.prisma.load.findMany({
        where,
        include: { broker: true },
        orderBy: [{ pickupAt: 'asc' }, { id: 'asc' }],
        take: query.limit + 1,
        ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      }),
      this.vehiclesOf(organizationId),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map((l) => this.toDto(l, vehicles)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async get(organizationId: string, id: string): Promise<LoadDto> {
    const [load, vehicles] = await Promise.all([
      this.prisma.load.findFirst({
        where: { id, OR: [{ organizationId: null }, { organizationId }] },
        include: { broker: true },
      }),
      this.vehiclesOf(organizationId),
    ]);
    if (!load)
      throw new NotFoundException(apiError('NOT_FOUND', 'Load not found'));
    return this.toDto(load, vehicles);
  }

  /** Manual load entered by the carrier; private to their organization. */
  async createManual(
    organizationId: string,
    input: LoadCreateInput,
  ): Promise<LoadDto> {
    const load = await this.prisma.load.create({
      data: { ...input, source: 'manual', isSimulated: false, organizationId },
      include: { broker: true },
    });
    return this.toDto(load, await this.vehiclesOf(organizationId));
  }

  private vehiclesOf(organizationId: string) {
    return this.prisma.vehicle.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  private toDto(load: LoadWithBroker, vehicles: Vehicle[]): LoadDto {
    const postedRate = load.postedRate.toNumber();
    const distanceKm = load.distanceKm.toNumber();
    // Phase 0: profit uses the first vehicle with matching equipment.
    // Deadhead (distance to pickup) arrives with vehicle location in Phase 1.
    const vehicle = vehicles.find((v) => v.equipment === load.equipment);
    const estimate = vehicle
      ? estimateProfit({
          postedRate,
          distanceKm,
          costPerKm: vehicle.costPerKm.toNumber(),
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
      estimatedProfit: estimate?.profit ?? null,
      ratePerKm:
        distanceKm > 0 ? Math.round((postedRate / distanceKm) * 100) / 100 : 0,
    };
  }
}
