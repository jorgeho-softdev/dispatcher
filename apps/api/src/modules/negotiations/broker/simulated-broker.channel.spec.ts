import { SimulatedBrokerChannel } from './simulated-broker.channel';

const ref = {
  id: 'n1',
  loadId: '6ebbaf29-9c42-4480-844b-6ddcda45fdc5',
  postedRate: 1000,
  round: 1,
};

describe('SimulatedBrokerChannel', () => {
  const max = SimulatedBrokerChannel.brokerMax(ref.loadId, ref.postedRate);

  it('has a deterministic hidden max 3–11 % above the posted rate', () => {
    expect(SimulatedBrokerChannel.brokerMax(ref.loadId, 1000)).toBe(max);
    expect(max).toBeGreaterThanOrEqual(1030);
    expect(max).toBeLessThanOrEqual(1110);
  });

  it('accepts offers up to its max', () => {
    expect(SimulatedBrokerChannel.respondToOffer(ref, max)).toMatchObject({
      type: 'accept',
      amount: max,
    });
  });

  it('counters between posted rate and its max, and rejects absurd asks', () => {
    const r = SimulatedBrokerChannel.respondToOffer(ref, 1200);
    expect(r.type).toBe('counter');
    if (r.type === 'counter') {
      expect(r.amount).toBeGreaterThanOrEqual(1000);
      expect(r.amount).toBeLessThanOrEqual(max);
    }
    expect(SimulatedBrokerChannel.respondToOffer(ref, 2000).type).toBe(
      'reject',
    );
  });

  it('gives its final (max) offer from round 3', () => {
    expect(
      SimulatedBrokerChannel.respondToOffer({ ...ref, round: 3 }, 1200),
    ).toMatchObject({ type: 'counter', amount: max });
  });
});
