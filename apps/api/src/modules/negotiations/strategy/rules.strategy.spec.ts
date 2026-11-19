import { rateBounds, type PolicyLimits } from '@dispatcher/shared';
import { RulesStrategy } from './rules.strategy';
import type { StrategyContext } from './negotiation-strategy';

const limits: PolicyLimits = {
  postedRate: 1280,
  distanceKm: 300,
  deadheadKm: 10,
  costPerKm: 1.7,
  minRatePerKm: 2.5,
  minMarginPct: 30,
  maxCounterOfferPct: 15,
};
const ctx = (round: number): StrategyContext => ({
  locale: 'es',
  currency: 'CAD',
  load: {
    originCity: 'Calgary',
    originProvince: 'AB',
    destinationCity: 'Edmonton',
    destinationProvince: 'AB',
    pickupAt: new Date(),
    equipment: 'box_truck',
    weightKg: 3000,
    brokerName: null,
  },
  limits,
  bounds: rateBounds(limits),
  round,
  maxRounds: 3,
  history: [],
});

describe('RulesStrategy', () => {
  const s = new RulesStrategy();

  it('opens at 60% of the allowed markup, rounded to tens', async () => {
    const p = await s.proposeOpening(ctx(0));
    expect(p.amount).toBe(1400); // 1280 × 1.09 = 1395.2 → 1400
    expect(p.reasonCode).toBe('target_markup');
    expect(p.reasonParams).toEqual({ pct: 9 });
    expect(p.brokerMessage).not.toMatch(/floor|cost|margin/i);
  });

  it('accepts a counter close to the last offer', async () => {
    const d = await s.respondToCounter(ctx(1), 1370, 1400);
    expect(d.action).toBe('accept');
  });

  it('meets halfway when the counter is far', async () => {
    const d = await s.respondToCounter(ctx(1), 1300, 1400);
    expect(d).toMatchObject({
      action: 'counter',
      amount: 1350,
      reasonCode: 'counter_midpoint',
    });
  });

  it('on the last round accepts if acceptable, otherwise walks away', async () => {
    expect((await s.respondToCounter(ctx(3), 1300, 1400)).action).toBe(
      'accept',
    );
    expect((await s.respondToCounter(ctx(3), 700, 1400)).action).toBe(
      'walk_away',
    );
  });
});
