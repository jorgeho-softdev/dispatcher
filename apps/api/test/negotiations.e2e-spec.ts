import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  AiSettingsDto,
  ApiErrorDto,
  LoadListDto,
  NegotiationDetailDto,
  NegotiationStatus,
} from '@dispatcher/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Phase 2: full assisted workflow through BullMQ + simulated broker. Needs db:up + db:seed.
describe('Negotiations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let auth: { authorization: string };
  let original: AiSettingsDto;
  const touchedLoads: string[] = [];

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
  });

  afterAll(async () => {
    await prisma.negotiation.deleteMany({
      where: { loadId: { in: touchedLoads } },
    });
    await prisma.load.updateMany({
      where: { id: { in: touchedLoads } },
      data: { status: 'available' },
    });
    const { autonomyLevel, ...rest } = original;
    await request(app.getHttpServer())
      .patch('/v1/ai-settings')
      .set(auth)
      .send({ ...rest, autonomyLevel });
    await app.close();
  });

  const pickLoad = async (skip = 0) => {
    const { items } = (
      await request(app.getHttpServer())
        .get('/v1/loads?view=recommended&limit=20')
        .set(auth)
        .expect(200)
    ).body as LoadListDto;
    const active = (
      await request(app.getHttpServer())
        .get('/v1/negotiations?filter=active')
        .set(auth)
    ).body as NegotiationDetailDto[];
    const busy = new Set(active.map((n) => n.load.id));
    const load = items.filter(
      (l) => !touchedLoads.includes(l.id) && !busy.has(l.id),
    )[skip]!;
    touchedLoads.push(load.id);
    return load;
  };

  const get = async (id: string) =>
    (
      await request(app.getHttpServer())
        .get(`/v1/negotiations/${id}`)
        .set(auth)
        .expect(200)
    ).body as NegotiationDetailDto;

  /** Polls until the background jobs move the negotiation to one of `statuses`. */
  const waitFor = async (id: string, statuses: NegotiationStatus[]) => {
    for (let i = 0; i < 100; i++) {
      const n = await get(id);
      if (statuses.includes(n.status)) return n;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(
      `timeout waiting for ${statuses.join('|')} (now ${(await get(id)).status})`,
    );
  };

  it('assisted: AI proposes → user approves → negotiates → user books', async () => {
    await request(app.getHttpServer())
      .patch('/v1/ai-settings')
      .set(auth)
      .send({ autonomyLevel: 'assisted' })
      .expect(200);
    const load = await pickLoad();

    const started = (
      await request(app.getHttpServer())
        .post('/v1/negotiations')
        .set(auth)
        .send({ loadId: load.id })
        .expect(201)
    ).body as NegotiationDetailDto;
    expect(started.status).toBe('ai_thinking');

    // AI proposes within the policy limits and waits for approval.
    let n = await waitFor(started.id, ['awaiting_send_approval']);
    expect(n.currentOffer).toBeGreaterThanOrEqual(n.postedRate);
    expect(n.currentOffer).toBeLessThanOrEqual(n.ceilingRate);
    expect(n.latestAi?.reasonCode).toBe('target_markup');
    expect(n.allowedActions).toEqual([
      'approve_send',
      'adjust_offer',
      'cancel',
    ]);

    // Approve every offer until the broker agrees.
    for (let i = 0; i < 5 && n.status !== 'awaiting_booking_approval'; i++) {
      if (n.status === 'awaiting_send_approval') {
        await request(app.getHttpServer())
          .post(`/v1/negotiations/${n.id}/approve-send`)
          .set(auth)
          .expect(200);
      }
      n = await waitFor(n.id, [
        'awaiting_send_approval',
        'awaiting_booking_approval',
        'rejected',
      ]);
    }
    expect(n.status).toBe('awaiting_booking_approval');
    expect(n.agreedRate).toBeGreaterThanOrEqual(n.floorRate);

    await request(app.getHttpServer())
      .post(`/v1/negotiations/${n.id}/approve-booking`)
      .set(auth)
      .expect(200);
    n = await waitFor(n.id, ['booked']);

    // Full audit trail, and the load is no longer available to anyone.
    const types = n.events.map((e) => e.type);
    expect(types[0]).toBe('ai_proposed');
    expect(types).toEqual(
      expect.arrayContaining([
        'user_approved_send',
        'offer_sent',
        'booking_confirmed',
      ]),
    );
    const dbLoad = await prisma.load.findUnique({ where: { id: load.id } });
    expect(dbLoad?.status).toBe('booked');
  });

  it('semi-auto: AI sends offers by itself but booking still needs approval', async () => {
    await request(app.getHttpServer())
      .patch('/v1/ai-settings')
      .set(auth)
      .send({ autonomyLevel: 'semi_auto' })
      .expect(200);
    const load = await pickLoad();
    const { id } = (
      await request(app.getHttpServer())
        .post('/v1/negotiations')
        .set(auth)
        .send({ loadId: load.id })
        .expect(201)
    ).body as NegotiationDetailDto;

    const n = await waitFor(id, ['awaiting_booking_approval', 'rejected']);
    expect(n.events.some((e) => e.type === 'user_approved_send')).toBe(false);
    expect(n.events.some((e) => e.type === 'offer_sent')).toBe(true);
  });

  it('rejects a second active negotiation and actions in the wrong state', async () => {
    await request(app.getHttpServer())
      .patch('/v1/ai-settings')
      .set(auth)
      .send({ autonomyLevel: 'assisted' })
      .expect(200);
    const load = await pickLoad();
    const { id } = (
      await request(app.getHttpServer())
        .post('/v1/negotiations')
        .set(auth)
        .send({ loadId: load.id })
        .expect(201)
    ).body as NegotiationDetailDto;

    const dup = await request(app.getHttpServer())
      .post('/v1/negotiations')
      .set(auth)
      .send({ loadId: load.id })
      .expect(409);
    expect((dup.body as ApiErrorDto).code).toBe('NEGOTIATION_ALREADY_ACTIVE');

    await waitFor(id, ['awaiting_send_approval']);
    const wrong = await request(app.getHttpServer())
      .post(`/v1/negotiations/${id}/approve-booking`)
      .set(auth)
      .expect(409);
    expect((wrong.body as ApiErrorDto).code).toBe('NEGOTIATION_INVALID_STATE');

    // Adjusting above the ceiling is clamped by the policy engine, and audited.
    const adjusted = (
      await request(app.getHttpServer())
        .post(`/v1/negotiations/${id}/adjust`)
        .set(auth)
        .send({ amount: 999_999 })
        .expect(200)
    ).body as NegotiationDetailDto;
    expect(adjusted.currentOffer).toBeLessThanOrEqual(adjusted.ceilingRate);
    expect(adjusted.events.at(-1)?.type).toBe('policy_adjusted');

    const cancelled = (
      await request(app.getHttpServer())
        .post(`/v1/negotiations/${id}/cancel`)
        .set(auth)
        .expect(200)
    ).body as NegotiationDetailDto;
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.allowedActions).toEqual([]);
  });
});
