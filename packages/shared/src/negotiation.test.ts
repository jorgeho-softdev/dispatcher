import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NEGOTIATION_STATUSES,
  TERMINAL_STATUSES,
  allowedActions,
  brokerOfferAcceptable,
  canTransition,
  checkOffer,
  rateBounds,
  requiresApproval,
  type PolicyLimits,
} from './negotiation';

// Mockup: Calgary → Edmonton, CA$1,280 posted, 300 km.
const limits: PolicyLimits = {
  postedRate: 1280,
  distanceKm: 300,
  deadheadKm: 10,
  costPerKm: 1.7,
  minRatePerKm: 2.5,
  minMarginPct: 30,
  maxCounterOfferPct: 15,
};

test('bounds: floor from margin/rate minimums, ceiling from max counter-offer', () => {
  const b = rateBounds(limits);
  // costs 310×1.7=527 → 527/0.7=752.86 ; rate floor 2.5×300=750
  assert.equal(b.floor, 752.86);
  assert.equal(b.ceiling, 1472);
  assert.equal(b.viable, true);
});

test('offers inside the range pass untouched', () => {
  assert.deepEqual(checkOffer(1350, limits), { ok: true, amount: 1350, adjusted: false });
});

test('offers are clamped and audited, never sent out of range', () => {
  const high = checkOffer(5000, limits);
  assert.ok(high.ok && high.adjusted && high.reason === 'clamped_to_ceiling' && high.amount === 1470);
  const low = checkOffer(900, limits); // below posted rate
  assert.ok(low.ok && low.adjusted && low.reason === 'clamped_to_floor' && low.amount === 1280);
});

test('blocked when even the ceiling misses the minimums', () => {
  const r = checkOffer(1000, { ...limits, postedRate: 500, maxCounterOfferPct: 10 });
  assert.deepEqual(r, { ok: false, reason: 'unprofitable_at_ceiling' });
});

test('broker counters are acceptable only at or above the floor', () => {
  assert.equal(brokerOfferAcceptable(760, limits), true);
  assert.equal(brokerOfferAcceptable(700, limits), false);
});

test('approval rules per autonomy level', () => {
  assert.equal(requiresApproval('assisted', 'send_offer'), true);
  assert.equal(requiresApproval('semi_auto', 'send_offer'), false);
  assert.equal(requiresApproval('auto', 'send_offer'), false);
  for (const a of ['assisted', 'semi_auto', 'auto'] as const) assert.equal(requiresApproval(a, 'book'), true);
});

test('terminal states have no transitions or actions', () => {
  for (const s of TERMINAL_STATUSES) {
    assert.deepEqual(allowedActions(s), []);
    for (const to of NEGOTIATION_STATUSES) assert.equal(canTransition(s, to), false);
  }
  assert.equal(canTransition('awaiting_send_approval', 'contacting_broker'), true);
  assert.equal(canTransition('awaiting_send_approval', 'booked'), false);
  assert.equal(canTransition('contacting_broker', 'ai_thinking'), true);
  assert.deepEqual(allowedActions('ai_thinking'), ['cancel']);
});
