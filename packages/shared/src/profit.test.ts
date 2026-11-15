import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateProfit } from './profit';

test('Calgary → Edmonton box truck matches the mockup ballpark', () => {
  const r = estimateProfit({ postedRate: 1280, distanceKm: 300, costPerKm: 1.7 });
  assert.equal(r.costs, 510);
  assert.equal(r.profit, 770);
  assert.equal(r.marginPct, 60.16);
  assert.equal(r.ratePerKm, 4.27);
});

test('deadhead and tolls count as cost', () => {
  const r = estimateProfit({ postedRate: 1000, distanceKm: 200, deadheadKm: 50, costPerKm: 2, tolls: 25 });
  assert.equal(r.totalKm, 250);
  assert.equal(r.costs, 525);
  assert.equal(r.profit, 475);
});

test('zero rate does not divide by zero', () => {
  const r = estimateProfit({ postedRate: 0, distanceKm: 0, costPerKm: 1 });
  assert.equal(r.marginPct, 0);
  assert.equal(r.ratePerKm, 0);
});
