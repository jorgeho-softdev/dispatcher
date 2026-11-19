import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { refreshSimulatedMarketplace } from './marketplace';

// Refreshes ONLY the simulated (DEMO) marketplace — no demo user, no
// passwords. Used by the beta deploy (Railway pre-deploy) so testers see
// loads until real load boards arrive in Phase 5. Production requires an
// explicit opt-in: SIMULATED_MARKETPLACE=true.

async function main() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.SIMULATED_MARKETPLACE !== 'true'
  ) {
    console.log(
      'Simulated marketplace disabled (SIMULATED_MARKETPLACE != true). Skipping.',
    );
    return;
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    const r = await refreshSimulatedMarketplace(prisma);
    console.log(
      `Simulated marketplace (DEMO): ${r.created} created, ${r.refreshed} refreshed of ${r.total}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
