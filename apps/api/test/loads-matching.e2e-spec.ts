import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  AiSettingsDto,
  LoadDetailDto,
  LoadListDto,
  VehicleDto,
} from '@dispatcher/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Phase 1: views, deadhead, match, manual loads, preferences. Needs db:seed.
describe('Loads matching (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let auth: { authorization: string };
  let original: AiSettingsDto;
  let vehicle: VehicleDto;
  const created: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    prisma = app.get(PrismaService);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'demo@aidispatcher.dev', password: 'Demo1234!' });
    auth = {
      authorization: `Bearer ${(res.body as { accessToken: string }).accessToken}`,
    };
    original = (
      await request(app.getHttpServer()).get('/v1/ai-settings').set(auth)
    ).body as AiSettingsDto;
    vehicle = (
      (await request(app.getHttpServer()).get('/v1/vehicles').set(auth))
        .body as VehicleDto[]
    )[0]!;
  });

  afterAll(async () => {
    await prisma.load.deleteMany({ where: { id: { in: created } } });
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { lastLat: null, lastLng: null, lastLocationAt: null },
    });
    const { autonomyLevel: _a, ...restore } = original;
    await request(app.getHttpServer())
      .patch('/v1/ai-settings')
      .set(auth)
      .send(restore);
    await app.close();
  });

  const list = async (query: string) =>
    (
      await request(app.getHttpServer())
        .get(`/v1/loads?${query}`)
        .set(auth)
        .expect(200)
    ).body as LoadListDto;

  it('recommended view is sorted by match score and only compatible loads', async () => {
    const { items, context } = await list('view=recommended&limit=100');
    expect(context.vehicle?.id).toBe(vehicle.id);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((l) => l.match?.compatible)).toBe(true);
    const scores = items.map((l) => l.match!.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('nearby view uses PostGIS radius and the explicit position', async () => {
    const { items, context } = await list(
      'view=nearby&lat=53.5461&lng=-113.4938&radiusKm=50',
    );
    expect(context.positionSource).toBe('request');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((l) => l.originCity === 'Edmonton')).toBe(true);
    expect(items.every((l) => (l.deadheadKm ?? 999) < 5)).toBe(true);
  });

  it('paginates with an opaque cursor without repeating loads', async () => {
    const first = await list('view=all&limit=10');
    const second = await list(`view=all&limit=10&cursor=${first.nextCursor}`);
    const ids = new Set(first.items.map((l) => l.id));
    expect(second.items.some((l) => ids.has(l.id))).toBe(false);
  });

  it('a reported GPS fix becomes the position for deadhead', async () => {
    await request(app.getHttpServer())
      .post(`/v1/vehicles/${vehicle.id}/location`)
      .set(auth)
      .send({ lat: 53.5461, lng: -113.4938 })
      .expect(204);
    const { context } = await list('view=all&limit=1');
    expect(context.positionSource).toBe('vehicle_gps');
  });

  it('creates a manual load from catalog cities and estimates distance', async () => {
    const pickupAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/v1/loads')
      .set(auth)
      .send({
        originCity: 'Red Deer',
        originProvince: 'AB',
        destinationCity: 'Saskatoon',
        destinationProvince: 'SK',
        pickupAt,
        weightKg: 2000,
        equipment: 'box_truck',
        postedRate: 1900,
      })
      .expect(201);
    const load = res.body as LoadDetailDto;
    created.push(load.id);
    expect(load.source).toBe('manual');
    expect(load.isSimulated).toBe(false);
    expect(load.distanceKm).toBeGreaterThan(500);
    expect(load.breakdown?.profit).toBe(load.estimatedProfit);
  });

  it('avoided provinces are never recommended', async () => {
    await request(app.getHttpServer())
      .patch('/v1/ai-settings')
      .set(auth)
      .send({ preferredProvinces: [], avoidProvinces: ['BC'] })
      .expect(200);
    const { items } = await list('view=recommended&limit=100');
    expect(
      items.some(
        (l) => l.originProvince === 'BC' || l.destinationProvince === 'BC',
      ),
    ).toBe(false);
  });
});
