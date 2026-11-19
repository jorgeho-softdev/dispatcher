import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiPerformance, csvCell, groupTrips, monthKey, totalsOf, type ReportTripRow } from './reports';

const row = (over: Partial<ReportTripRow>): ReportTripRow => ({
  completedAt: new Date('2026-11-10T18:00:00Z'),
  currency: 'CAD',
  rate: 1000,
  expenses: 400,
  loadedKm: 300,
  vehicleId: 'v1',
  vehicleName: 'Box 1',
  driverId: 'd1',
  driverName: 'Carlos',
  lane: 'AB → AB',
  ...over,
});

test('totals: revenue, profit, margin, revenue/km', () => {
  const t = totalsOf([row({}), row({ rate: 1350, expenses: 532, loadedKm: 300 })]);
  assert.deepEqual(t, { trips: 2, revenue: 2350, expenses: 932, profit: 1418, marginPct: 60.34, loadedKm: 600, revenuePerKm: 3.92 });
  assert.equal(totalsOf([]).marginPct, 0);
});

test('months are chronological and fill empty months', () => {
  const g = groupTrips(
    [row({ completedAt: new Date('2026-09-05T18:00:00Z') }), row({ completedAt: new Date('2026-11-05T18:00:00Z') })],
    'month',
  );
  assert.deepEqual(g.map((x) => [x.key, x.trips]), [['2026-09', 1], ['2026-10', 0], ['2026-11', 1]]);
});

test('month boundaries use the carrier time zone (Alberta)', () => {
  // 2026-12-01 03:00 UTC is still Nov 30 in Edmonton.
  assert.equal(monthKey(new Date('2026-12-01T03:00:00Z')), '2026-11');
});

test('other groups sort by profit', () => {
  const g = groupTrips([row({ vehicleId: 'a', vehicleName: 'A', rate: 500 }), row({ vehicleId: 'b', vehicleName: 'B', rate: 2000 })], 'vehicle');
  assert.deepEqual(g.map((x) => x.label), ['B', 'A']);
});

test('AI performance: close rate, uplift, per strategy', () => {
  const p = aiPerformance([
    { status: 'booked', strategy: 'rules', postedRate: 1000, agreedRate: 1100, rounds: 2 },
    { status: 'booked', strategy: 'claude', postedRate: 1000, agreedRate: 1050, rounds: 1 },
    { status: 'rejected', strategy: 'rules', postedRate: 900, agreedRate: null, rounds: 3 },
    { status: 'cancelled', strategy: 'rules', postedRate: 900, agreedRate: null, rounds: 0 },
  ]);
  assert.equal(p.finished, 3);
  assert.equal(p.closeRatePct, 66.67);
  assert.equal(p.avgUpliftPct, 7.5);
  assert.equal(p.totalUplift, 150);
  assert.equal(p.avgRounds, 2);
  assert.deepEqual(p.byStrategy.map((s) => s.strategy), ['claude', 'rules']);
});

test('CSV cells are escaped and formula-safe', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell(-12.5), '-12.5');
  assert.equal(csvCell(null), '');
});
