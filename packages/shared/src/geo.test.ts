import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateRoadKm, findCity, haversineKm } from './geo';

test('haversine Calgary → Edmonton ≈ 280 km straight line', () => {
  const d = haversineKm(findCity('Calgary', 'AB')!, findCity('Edmonton', 'AB')!);
  assert.ok(d > 270 && d < 290, String(d));
});

test('road estimate applies the road factor', () => {
  const a = findCity('Calgary', 'AB')!;
  const b = findCity('Red Deer', 'AB')!;
  assert.equal(estimateRoadKm(a, b), Math.round(haversineKm(a, b) * 1.25 * 10) / 10);
});

test('findCity ignores accents and case', () => {
  assert.equal(findCity('montreal', 'qc')?.city, 'Montréal');
  assert.equal(findCity('Calgary', 'BC'), undefined);
});
