import { SimulatedLoadProvider } from './simulated.provider';

describe('SimulatedLoadProvider', () => {
  const now = () => new Date('2026-11-13T12:00:00Z');

  it('is deterministic for the same seed', async () => {
    const a = await new SimulatedLoadProvider(7, now).search({ limit: 10 });
    const b = await new SimulatedLoadProvider(7, now).search({ limit: 10 });
    expect(a).toEqual(b);
  });

  it('always flags loads as simulated and brokers as DEMO', async () => {
    const loads = await new SimulatedLoadProvider(1, now).search({ limit: 30 });
    expect(loads.length).toBeGreaterThan(0);
    for (const load of loads) {
      expect(load.isSimulated).toBe(true);
      expect(load.source).toBe('simulated');
      expect(load.broker?.name).toMatch(/\(DEMO\)$/);
      expect(load.postedRate).toBeGreaterThanOrEqual(250);
      expect(load.pickupAt.getTime()).toBeGreaterThan(now().getTime());
    }
  });

  it('respects the equipment filter', async () => {
    const loads = await new SimulatedLoadProvider(3, now).search({
      equipment: ['sprinter'],
      limit: 20,
    });
    expect(loads.every((l) => l.equipment === 'sprinter')).toBe(true);
  });
});
