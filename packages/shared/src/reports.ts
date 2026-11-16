import type { Currency } from './constants';

// ════════════════════════════════════════════════════════════════════════
//  Reports (Phase 4): financial summaries of COMPLETED trips and the AI
//  dispatcher's negotiation performance. Pure functions, unit-tested; the
//  api feeds them rows. See docs/reports.md.
// ════════════════════════════════════════════════════════════════════════

export const REPORT_GROUPS = ['month', 'vehicle', 'driver', 'lane'] as const;
export type ReportGroup = (typeof REPORT_GROUPS)[number];

export interface ReportTripRow {
  completedAt: Date;
  currency: Currency;
  rate: number;
  expenses: number;
  loadedKm: number;
  vehicleId: string;
  vehicleName: string;
  driverId: string;
  driverName: string;
  /** "AB → SK" (province pair; lanes at city level are too sparse for an MVP). */
  lane: string;
}

export interface ReportTotals {
  trips: number;
  revenue: number;
  expenses: number;
  profit: number;
  marginPct: number;
  loadedKm: number;
  revenuePerKm: number;
}

export interface ReportGroupRow extends ReportTotals {
  key: string;
  label: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function totalsOf(rows: readonly ReportTripRow[]): ReportTotals {
  const revenue = r2(rows.reduce((s, r) => s + r.rate, 0));
  const expenses = r2(rows.reduce((s, r) => s + r.expenses, 0));
  const loadedKm = r2(rows.reduce((s, r) => s + r.loadedKm, 0));
  const profit = r2(revenue - expenses);
  return {
    trips: rows.length,
    revenue,
    expenses,
    profit,
    marginPct: revenue > 0 ? r2((profit / revenue) * 100) : 0,
    loadedKm,
    revenuePerKm: loadedKm > 0 ? r2(revenue / loadedKm) : 0,
  };
}

/** "2026-11" in the given time zone (months are calendar months for the carrier). */
export function monthKey(date: Date, timeZone = 'America/Edmonton'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
}

/**
 * Groups completed trips. Months come back chronological (and include empty
 * months between the first and last so charts don't hide gaps); other
 * groups are sorted by profit, highest first.
 */
export function groupTrips(rows: readonly ReportTripRow[], group: ReportGroup, timeZone?: string): ReportGroupRow[] {
  const buckets = new Map<string, { label: string; rows: ReportTripRow[] }>();
  for (const row of rows) {
    const [key, label] =
      group === 'month'
        ? [monthKey(row.completedAt, timeZone), monthKey(row.completedAt, timeZone)]
        : group === 'vehicle'
          ? [row.vehicleId, row.vehicleName]
          : group === 'driver'
            ? [row.driverId, row.driverName]
            : [row.lane, row.lane];
    const bucket = buckets.get(key) ?? { label, rows: [] };
    bucket.rows.push(row);
    buckets.set(key, bucket);
  }

  if (group === 'month' && buckets.size > 0) {
    const keys = [...buckets.keys()].sort();
    const [fy, fm] = keys[0]!.split('-').map(Number) as [number, number];
    const [ly, lm] = keys[keys.length - 1]!.split('-').map(Number) as [number, number];
    for (let y = fy, m = fm; y < ly || (y === ly && m <= lm); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!buckets.has(key)) buckets.set(key, { label: key, rows: [] });
    }
  }

  const result = [...buckets.entries()].map(([key, b]) => ({ key, label: b.label, ...totalsOf(b.rows) }));
  return group === 'month'
    ? result.sort((a, b) => a.key.localeCompare(b.key))
    : result.sort((a, b) => b.profit - a.profit);
}

// ── AI dispatcher performance ──────────────────────────────────────────

export interface AiNegotiationRow {
  status: string;
  strategy: 'claude' | 'rules';
  postedRate: number;
  agreedRate: number | null;
  rounds: number;
}

export interface AiPerformance {
  negotiations: number;
  /** Finished = booked + rejected + failed (cancelled by the user excluded). */
  finished: number;
  booked: number;
  /** booked / finished, 0–100. */
  closeRatePct: number;
  /** Average % the agreed rate beat the posted rate on booked loads. */
  avgUpliftPct: number;
  /** Extra revenue won vs. accepting every posted rate. */
  totalUplift: number;
  avgRounds: number;
  byStrategy: { strategy: 'claude' | 'rules'; negotiations: number; booked: number; avgUpliftPct: number }[];
}

export function aiPerformance(rows: readonly AiNegotiationRow[]): AiPerformance {
  const booked = rows.filter((r) => r.status === 'booked' && r.agreedRate !== null);
  const finished = rows.filter((r) => ['booked', 'rejected', 'failed'].includes(r.status));
  const uplift = (r: AiNegotiationRow) => ((r.agreedRate! - r.postedRate) / r.postedRate) * 100;
  const avg = (xs: number[]) => (xs.length ? r2(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
  const strategies = ['claude', 'rules'] as const;

  return {
    negotiations: rows.length,
    finished: finished.length,
    booked: booked.length,
    closeRatePct: finished.length ? r2((booked.length / finished.length) * 100) : 0,
    avgUpliftPct: avg(booked.map(uplift)),
    totalUplift: r2(booked.reduce((s, r) => s + (r.agreedRate! - r.postedRate), 0)),
    avgRounds: avg(rows.filter((r) => r.rounds > 0).map((r) => r.rounds)),
    byStrategy: strategies
      .map((strategy) => {
        const all = rows.filter((r) => r.strategy === strategy);
        const won = booked.filter((r) => r.strategy === strategy);
        return { strategy, negotiations: all.length, booked: won.length, avgUpliftPct: avg(won.map(uplift)) };
      })
      .filter((s) => s.negotiations > 0),
  };
}

/** RFC 4180 CSV cell (also neutralizes spreadsheet formula injection). */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string') s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
