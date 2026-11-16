import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_TRIP_STATUSES,
  TRIP_STATUSES,
  canCompleteTrip,
  canTripTransition,
  estimateEta,
  nextTripStatus,
  tripCode,
  tripFinancials,
} from './trips';
import { findCity } from './geo';

test('lifecycle: pickup → in transit → delivered → completed; no skipping', () => {
  assert.equal(nextTripStatus('scheduled'), 'at_pickup');
  assert.equal(nextTripStatus('at_pickup'), 'in_transit');
  assert.equal(nextTripStatus('in_transit'), 'delivered');
  assert.equal(nextTripStatus('delivered'), null);
  assert.equal(canTripTransition('scheduled', 'in_transit'), false);
  assert.equal(canTripTransition('in_transit', 'cancelled'), false); // loaded freight can't be cancelled
  for (const s of ['completed', 'cancelled'] as const) {
    for (const to of TRIP_STATUSES) assert.equal(canTripTransition(s, to), false);
  }
  assert.ok(!ACTIVE_TRIP_STATUSES.includes('completed'));
});

test('a trip closes only when delivered and with POD', () => {
  assert.equal(canCompleteTrip('delivered', true), true);
  assert.equal(canCompleteTrip('delivered', false), false);
  assert.equal(canCompleteTrip('in_transit', true), false);
});

test('mockup close-out: CA$1,350 − CA$532 = CA$818, 60.6 %', () => {
  const f = tripFinancials({ currency: 'CAD', rate: 1350, plannedKm: 310, costPerKm: 1.7, expenses: [{ amount: 400 }, { amount: 132 }] });
  assert.equal(f.actualExpenses, 532);
  assert.equal(f.actualProfit, 818);
  assert.equal(f.actualMarginPct, 60.59);
  assert.equal(f.estimatedCosts, 527);
});

test('ETA: Red Deer → Edmonton at default speed', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const { remainingKm, etaAt } = estimateEta(findCity('Red Deer', 'AB')!, findCity('Edmonton', 'AB')!, now);
  // ~144 km straight line × 1.25 road factor.
  assert.ok(remainingKm > 170 && remainingKm < 190, String(remainingKm));
  assert.equal(etaAt.getTime(), now.getTime() + (remainingKm / 75) * 3_600_000);
  // Implausible speeds are ignored.
  assert.deepEqual(estimateEta(findCity('Red Deer', 'AB')!, findCity('Edmonton', 'AB')!, now, 300), { remainingKm, etaAt });
});

test('trip codes', () => {
  assert.equal(tripCode(1045), 'TR-1045');
});
