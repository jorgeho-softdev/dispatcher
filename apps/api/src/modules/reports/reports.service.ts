import { Injectable } from '@nestjs/common';
import {
  aiPerformance,
  csvCell,
  groupTrips,
  totalsOf,
  tripCode,
  type AiPerformanceDto,
  type ReportQuery,
  type ReportSummaryDto,
  type ReportTripRow,
} from '@dispatcher/shared';
import type { AuthContext } from '../../common/auth-context';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Financial reports over COMPLETED trips (real profit is final only then)
 * and the AI dispatcher's negotiation performance (docs/reports.md).
 * Aggregation is done by the pure, tested functions in @dispatcher/shared.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(
    auth: AuthContext,
    query: ReportQuery,
  ): Promise<ReportSummaryDto> {
    const { currency, rows } = await this.tripRows(auth, query);
    return {
      from: query.from.toISOString(),
      to: query.to.toISOString(),
      currency,
      groupBy: query.groupBy,
      totals: totalsOf(rows),
      groups: groupTrips(rows, query.groupBy),
    };
  }

  /** One row per completed trip; UTF-8 BOM so Excel opens accents correctly. */
  async tripsCsv(auth: AuthContext, query: ReportQuery): Promise<string> {
    const trips = await this.completedTrips(auth, query);
    const header = [
      'trip',
      'completed_at',
      'origin',
      'destination',
      'vehicle',
      'driver',
      'currency',
      'rate',
      'expenses',
      'profit',
      'margin_pct',
      'loaded_km',
      'simulated',
    ];
    const lines = trips.map((t) => {
      const rate = t.rate.toNumber();
      const expenses = t.expenses.reduce((s, e) => s + e.amount.toNumber(), 0);
      const profit = rate - expenses;
      return [
        tripCode(t.sequence),
        t.completedAt?.toISOString() ?? '',
        `${t.load.originCity}, ${t.load.originProvince}`,
        `${t.load.destinationCity}, ${t.load.destinationProvince}`,
        t.vehicle.name,
        t.driver.name,
        t.currency,
        rate.toFixed(2),
        expenses.toFixed(2),
        profit.toFixed(2),
        rate > 0 ? ((profit / rate) * 100).toFixed(2) : '0',
        t.load.distanceKm.toNumber(),
        t.load.isSimulated ? 'yes' : 'no',
      ]
        .map(csvCell)
        .join(',');
    });
    return '﻿' + [header.join(','), ...lines].join('\r\n') + '\r\n';
  }

  async ai(auth: AuthContext, query: ReportQuery): Promise<AiPerformanceDto> {
    const negotiations = await this.prisma.negotiation.findMany({
      where: {
        organizationId: auth.organizationId,
        createdAt: { gte: query.from, lt: query.to },
      },
      select: {
        status: true,
        strategy: true,
        postedRate: true,
        agreedRate: true,
        round: true,
      },
    });
    return {
      from: query.from.toISOString(),
      to: query.to.toISOString(),
      ...aiPerformance(
        negotiations.map((n) => ({
          status: n.status,
          strategy: n.strategy,
          postedRate: n.postedRate.toNumber(),
          agreedRate: n.agreedRate?.toNumber() ?? null,
          rounds: n.round,
        })),
      ),
    };
  }

  private completedTrips(auth: AuthContext, query: ReportQuery) {
    return this.prisma.trip.findMany({
      where: {
        organizationId: auth.organizationId,
        status: 'completed',
        completedAt: { gte: query.from, lt: query.to },
      },
      include: { load: true, vehicle: true, driver: true, expenses: true },
      orderBy: { completedAt: 'asc' },
    });
  }

  /** Totals are reported in the organization's currency; other-currency trips are excluded (no FX yet). */
  private async tripRows(auth: AuthContext, query: ReportQuery) {
    const [org, trips] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: auth.organizationId },
      }),
      this.completedTrips(auth, query),
    ]);
    const rows: ReportTripRow[] = trips
      .filter((t) => t.currency === org.currency && t.completedAt)
      .map((t) => ({
        completedAt: t.completedAt!,
        currency: t.currency,
        rate: t.rate.toNumber(),
        expenses: t.expenses.reduce((s, e) => s + e.amount.toNumber(), 0),
        loadedKm: t.load.distanceKm.toNumber(),
        vehicleId: t.vehicleId,
        vehicleName: t.vehicle.name,
        driverId: t.driverId,
        driverName: t.driver.name,
        lane: `${t.load.originProvince} → ${t.load.destinationProvince}`,
      }));
    return { currency: org.currency, rows };
  }
}
