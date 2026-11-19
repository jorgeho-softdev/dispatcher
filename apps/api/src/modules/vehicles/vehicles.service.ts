import { apiError } from '../../common/api-error';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  findCity,
  type VehicleCreateInput,
  type VehicleDto,
  type VehicleLocationInput,
  type VehicleUpdateInput,
} from '@dispatcher/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { Vehicle } from '../../generated/prisma/client';

export function toVehicleDto(v: Vehicle): VehicleDto {
  return {
    id: v.id,
    name: v.name,
    equipment: v.equipment,
    plate: v.plate,
    capacityKg: v.capacityKg,
    costPerKm: v.costPerKm.toNumber(),
    homeBaseCity: v.homeBaseCity,
    homeBaseProvince: v.homeBaseProvince,
    homeBaseLat: v.homeBaseLat,
    homeBaseLng: v.homeBaseLng,
    lastLocationAt: v.lastLocationAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
  };
}

/**
 * Fills home-base coordinates from the city catalog when the client sends a
 * known city without coordinates (web/mobile city pickers).
 */
function withHomeBaseCoords<T extends VehicleUpdateInput>(input: T): T {
  if (
    input.homeBaseLat !== undefined ||
    !input.homeBaseCity ||
    !input.homeBaseProvince
  )
    return input;
  const city = findCity(input.homeBaseCity, input.homeBaseProvince);
  return city
    ? { ...input, homeBaseLat: city.lat, homeBaseLng: city.lng }
    : input;
}

// Every query is scoped by organizationId: a vehicle from another tenant is
// indistinguishable from one that doesn't exist (404, never 403).
@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<VehicleDto[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return vehicles.map(toVehicleDto);
  }

  async get(organizationId: string, id: string): Promise<VehicleDto> {
    return toVehicleDto(await this.findOwned(organizationId, id));
  }

  async create(
    organizationId: string,
    input: VehicleCreateInput,
  ): Promise<VehicleDto> {
    const vehicle = await this.prisma.vehicle.create({
      data: { ...withHomeBaseCoords(input), organizationId },
    });
    return toVehicleDto(vehicle);
  }

  async update(
    organizationId: string,
    id: string,
    input: VehicleUpdateInput,
  ): Promise<VehicleDto> {
    await this.findOwned(organizationId, id);
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: withHomeBaseCoords(input),
    });
    return toVehicleDto(vehicle);
  }

  /** Latest GPS fix reported by the driver app (deadhead / "near me"). */
  async reportLocation(
    organizationId: string,
    id: string,
    input: VehicleLocationInput,
  ): Promise<void> {
    await this.findOwned(organizationId, id);
    await this.prisma.vehicle.update({
      where: { id },
      data: {
        lastLat: input.lat,
        lastLng: input.lng,
        lastLocationAt: new Date(),
      },
    });
  }

  /** Soft delete: trips and reports keep referencing historical vehicles. */
  async remove(organizationId: string, id: string): Promise<void> {
    await this.findOwned(organizationId, id);
    await this.prisma.vehicle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async findOwned(
    organizationId: string,
    id: string,
  ): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!vehicle)
      throw new NotFoundException(apiError('NOT_FOUND', 'Vehicle not found'));
    return vehicle;
  }
}
