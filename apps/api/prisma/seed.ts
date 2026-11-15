import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { SimulatedLoadProvider } from '../src/modules/loads/providers/simulated.provider';

// Idempotent dev seed: a demo owner-operator + simulated marketplace loads.
// Safe to re-run; never run against production.

const DEMO_EMAIL = 'demo@aidispatcher.dev';
const DEMO_PASSWORD = 'Demo1234!';

async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing to seed production');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: DEMO_EMAIL,
          name: 'Carlos Demo',
          passwordHash: await hash(DEMO_PASSWORD),
          locale: 'es',
        },
      });
      const org = await prisma.organization.create({
        data: {
          name: 'Carlos Transport (DEMO)',
          aiSettings: { create: {} },
          vehicles: {
            create: {
              name: 'Box Truck 16ft',
              equipment: 'box_truck',
              plate: 'DEMO-001',
              capacityKg: 4500,
              costPerKm: 1.7,
              homeBaseCity: 'Calgary',
              homeBaseProvince: 'AB',
            },
          },
        },
      });
      await prisma.membership.create({
        data: { userId: user.id, organizationId: org.id, role: 'owner' },
      });
    }

    const loads = await new SimulatedLoadProvider(42).search({ limit: 40 });
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
      await prisma.load.upsert({
        where: {
          source_externalId: {
            source: load.source,
            externalId: load.externalId,
          },
        },
        create: data,
        update: data,
      });
    }

    console.log(`Seeded ${loads.length} simulated loads.`);
    console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
