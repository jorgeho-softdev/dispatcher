import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { findCity } from '@dispatcher/shared';
import { refreshSimulatedMarketplace } from './marketplace';

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
          aiSettings: { create: { preferredProvinces: ['AB'] } },
          vehicles: {
            create: {
              name: 'Box Truck 16ft',
              equipment: 'box_truck',
              plate: 'DEMO-001',
              capacityKg: 4500,
              costPerKm: 1.7,
              homeBaseCity: 'Calgary',
              homeBaseProvince: 'AB',
              homeBaseLat: 51.0447,
              homeBaseLng: -114.0719,
            },
          },
        },
      });
      await prisma.membership.create({
        data: { userId: user.id, organizationId: org.id, role: 'owner' },
      });
    }

    // Backfill home-base coordinates for vehicles created before Phase 1.
    const vehicles = await prisma.vehicle.findMany({
      where: { homeBaseLat: null, homeBaseCity: { not: null } },
    });
    for (const v of vehicles) {
      const city = findCity(v.homeBaseCity ?? '', v.homeBaseProvince ?? '');
      if (city) {
        await prisma.vehicle.update({
          where: { id: v.id },
          data: { homeBaseLat: city.lat, homeBaseLng: city.lng },
        });
      }
    }

    const r = await refreshSimulatedMarketplace(prisma);
    console.log(
      `Simulated loads: ${r.created} created, ${r.refreshed} refreshed.`,
    );
    console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
