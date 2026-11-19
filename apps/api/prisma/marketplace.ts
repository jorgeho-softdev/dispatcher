import type { PrismaClient } from '../src/generated/prisma/client';
import { SimulatedLoadProvider } from '../src/modules/loads/providers/simulated.provider';

/**
 * Upserts the SIMULATED marketplace (isSimulated=true, brokers "(DEMO)") with
 * pickup dates relative to now. Deterministic seed → the same externalIds
 * every run, so re-running refreshes dates instead of piling up loads.
 *
 * Never touches a load someone is negotiating or has booked: only loads still
 * `available` are updated.
 */
export async function refreshSimulatedMarketplace(prisma: PrismaClient) {
  const loads = await new SimulatedLoadProvider(42).search({ limit: 40 });
  let created = 0;
  let refreshed = 0;
  for (const { broker, rawPayload: _raw, ...load } of loads) {
    const brokerRecord = broker
      ? ((await prisma.broker.findFirst({ where: { name: broker.name } })) ??
        (await prisma.broker.create({ data: { name: broker.name } })))
      : null;
    const data = {
      ...load,
      organizationId: null,
      brokerId: brokerRecord?.id ?? null,
    };
    const key = { source: load.source, externalId: load.externalId };
    const existing = await prisma.load.findUnique({
      where: { source_externalId: key },
      select: { status: true },
    });
    if (!existing) {
      await prisma.load.create({ data });
      created++;
    } else if (existing.status === 'available') {
      await prisma.load.update({ where: { source_externalId: key }, data });
      refreshed++;
    }
  }
  return { created, refreshed, total: loads.length };
}
