import { Injectable, NotFoundException } from '@nestjs/common';
import type { LatLng, MatchInput, PositionSource } from '@dispatcher/shared';
import { apiError } from '../../common/api-error';
import { PrismaService } from '../../prisma/prisma.service';
import type { Vehicle } from '../../generated/prisma/client';

/** A GPS fix older than this is ignored in favour of the home base. */
const GPS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const DEFAULT_PREFERENCES: MatchInput['preferences'] = {
  minRatePerKm: 2.5,
  minMarginPct: 30,
  maxDeadheadKm: 150,
  preferredProvinces: [],
  avoidProvinces: [],
};

export interface MatchContext {
  vehicle: Vehicle | null;
  position: LatLng | null;
  positionSource: PositionSource;
  preferences: MatchInput['preferences'];
}

/**
 * Resolves WHO is being matched (vehicle), FROM WHERE (position) and with
 * WHICH rules (carrier preferences). Shared by the loads endpoints and, in
 * Phase 2, by the AI agent — so both always reason over the same inputs.
 */
@Injectable()
export class MatchingContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    organizationId: string,
    opts: { vehicleId?: string; lat?: number; lng?: number },
    now = new Date(),
  ): Promise<MatchContext> {
    const [vehicle, settings] = await Promise.all([
      this.resolveVehicle(organizationId, opts.vehicleId),
      this.prisma.aiSettings.findUnique({ where: { organizationId } }),
    ]);

    let position: LatLng | null = null;
    let positionSource: PositionSource = null;
    if (opts.lat !== undefined && opts.lng !== undefined) {
      position = { lat: opts.lat, lng: opts.lng };
      positionSource = 'request';
    } else if (
      vehicle?.lastLat != null &&
      vehicle.lastLng != null &&
      vehicle.lastLocationAt &&
      now.getTime() - vehicle.lastLocationAt.getTime() <= GPS_MAX_AGE_MS
    ) {
      position = { lat: vehicle.lastLat, lng: vehicle.lastLng };
      positionSource = 'vehicle_gps';
    } else if (vehicle?.homeBaseLat != null && vehicle.homeBaseLng != null) {
      position = { lat: vehicle.homeBaseLat, lng: vehicle.homeBaseLng };
      positionSource = 'home_base';
    }

    const preferences: MatchInput['preferences'] = settings
      ? {
          minRatePerKm: settings.minRatePerKm.toNumber(),
          minMarginPct: settings.minMarginPct.toNumber(),
          maxDeadheadKm: settings.maxDeadheadKm,
          preferredProvinces: settings.preferredProvinces,
          avoidProvinces: settings.avoidProvinces,
        }
      : DEFAULT_PREFERENCES;

    return { vehicle, position, positionSource, preferences };
  }

  private async resolveVehicle(
    organizationId: string,
    vehicleId?: string,
  ): Promise<Vehicle | null> {
    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: vehicleId, organizationId, deletedAt: null },
      });
      if (!vehicle)
        throw new NotFoundException(apiError('NOT_FOUND', 'Vehicle not found'));
      return vehicle;
    }
    return this.prisma.vehicle.findFirst({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }
}
