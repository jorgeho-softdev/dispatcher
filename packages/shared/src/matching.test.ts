import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatch, type MatchInput } from './matching';

const now = new Date('2026-11-15T12:00:00Z');
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);

const base: MatchInput = {
  load: {
    equipment: 'box_truck',
    weightKg: 3500,
    postedRate: 1280,
    distanceKm: 300,
    pickupAt: inHours(20),
    originProvince: 'AB',
    destinationProvince: 'AB',
  },
  vehicle: { equipment: 'box_truck', capacityKg: 4500, costPerKm: 1.7 },
  deadheadKm: 10,
  preferences: { minRatePerKm: 2.5, minMarginPct: 30, maxDeadheadKm: 150, preferredProvinces: ['AB'], avoidProvinces: [] },
  now,
};
const codes = (r: ReturnType<typeof scoreMatch>) => r.reasons.map((x) => x.code);

test('mockup case (Calgary → Edmonton, CA$1,280) scores as a top match', () => {
  const r = scoreMatch(base);
  assert.equal(r.compatible, true);
  assert.ok(r.score >= 90, `score ${r.score}`);
  assert.deepEqual(codes(r).sort(), ['equipment_ideal', 'good_rate', 'high_margin', 'pickup_soon', 'preferred_lane', 'short_deadhead'].sort());
  // Deadhead is a real cost: 310 km × 1.7.
  assert.equal(r.profit, 1280 - 310 * 1.7);
});

test('hard constraints score 0 and explain why', () => {
  assert.deepEqual(codes(scoreMatch({ ...base, vehicle: { ...base.vehicle, equipment: 'cargo_van' } })), ['equipment_incompatible']);
  assert.deepEqual(codes(scoreMatch({ ...base, load: { ...base.load, weightKg: 9000 } })), ['over_capacity']);
  assert.deepEqual(
    codes(scoreMatch({ ...base, preferences: { ...base.preferences, avoidProvinces: ['AB'] } })),
    ['avoided_region'],
  );
  assert.deepEqual(codes(scoreMatch({ ...base, load: { ...base.load, pickupAt: inHours(-1) } })), ['pickup_passed']);
  assert.equal(scoreMatch({ ...base, load: { ...base.load, weightKg: 9000 } }).score, 0);
});

test('a bigger vehicle can take a smaller load, flagged as larger', () => {
  const r = scoreMatch({ ...base, load: { ...base.load, equipment: 'cargo_van', weightKg: 800 } });
  assert.equal(r.compatible, true);
  assert.ok(codes(r).includes('equipment_larger'));
});

test('long deadhead and low rate lower the score', () => {
  const good = scoreMatch(base).score;
  const far = scoreMatch({ ...base, deadheadKm: 400 });
  const cheap = scoreMatch({ ...base, load: { ...base.load, postedRate: 600 } });
  assert.ok(far.score < good && codes(far).includes('long_deadhead'));
  assert.ok(cheap.score < good && codes(cheap).includes('low_rate') && codes(cheap).includes('low_margin'));
});

test('unknown position gives half deadhead points and says so', () => {
  const r = scoreMatch({ ...base, deadheadKm: null });
  assert.ok(codes(r).includes('deadhead_unknown'));
  assert.ok(r.score < scoreMatch(base).score);
});

test('score is always within 0..100', () => {
  for (const rate of [0, 100, 1280, 100_000]) {
    for (const dh of [null, 0, 75, 10_000]) {
      const s = scoreMatch({ ...base, deadheadKm: dh, load: { ...base.load, postedRate: rate } }).score;
      assert.ok(s >= 0 && s <= 100, `rate ${rate} dh ${dh} → ${s}`);
    }
  }
});
