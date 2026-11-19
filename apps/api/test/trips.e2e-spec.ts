import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  AiSettingsDto,
  ApiErrorDto,
  DownloadUrlDto,
  LoadListDto,
  NegotiationDetailDto,
  NegotiationStatus,
  TripDetailDto,
  TripDto,
  UploadUrlDto,
} from '@dispatcher/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Phase 3: booked negotiation → trip → progress → POD (real S3 upload) → close-out.
// Needs db:up (Postgres, Redis, S3) + db:seed.
describe('Trips (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let auth: { authorization: string };
  let original: AiSettingsDto;
  let loadId: string;
  let trip: TripDetailDto;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    prisma = app.get(PrismaService);
    const res = await http()
      .post('/v1/auth/login')
      .send({ email: 'demo@aidispatcher.dev', password: 'Demo1234!' });
    auth = {
      authorization: `Bearer ${(res.body as { accessToken: string }).accessToken}`,
    };
    original = (await http().get('/v1/ai-settings').set(auth))
      .body as AiSettingsDto;
    await http()
      .patch('/v1/ai-settings')
      .set(auth)
      .send({ autonomyLevel: 'semi_auto' });

    // Book a load through the AI workflow.
    const { items } = (
      await http().get('/v1/loads?view=recommended&limit=20').set(auth)
    ).body as LoadListDto;
    const active = (
      await http().get('/v1/negotiations?filter=active').set(auth)
    ).body as NegotiationDetailDto[];
    const busy = new Set(active.map((n) => n.load.id));
    loadId = items.find((l) => !busy.has(l.id))!.id;
    const { id } = (
      await http()
        .post('/v1/negotiations')
        .set(auth)
        .send({ loadId })
        .expect(201)
    ).body as NegotiationDetailDto;
    const waitFor = async (statuses: NegotiationStatus[]) => {
      for (let i = 0; i < 100; i++) {
        const n = (await http().get(`/v1/negotiations/${id}`).set(auth))
          .body as NegotiationDetailDto;
        if (statuses.includes(n.status)) return n;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('timeout');
    };
    await waitFor(['awaiting_booking_approval']);
    await http()
      .post(`/v1/negotiations/${id}/approve-booking`)
      .set(auth)
      .expect(200);
    await waitFor(['booked']);
    const trips = (await http().get('/v1/trips?filter=active').set(auth))
      .body as TripDto[];
    const created = trips.find((t) => t.negotiationId === id)!;
    trip = (await http().get(`/v1/trips/${created.id}`).set(auth))
      .body as TripDetailDto;
  });

  afterAll(async () => {
    await prisma.trip.deleteMany({ where: { loadId } });
    await prisma.negotiation.deleteMany({ where: { loadId } });
    await prisma.load.update({
      where: { id: loadId },
      data: { status: 'available' },
    });
    await prisma.brokerRating.deleteMany({ where: { tripId: trip?.id } });
    const { autonomyLevel } = original;
    await http().patch('/v1/ai-settings').set(auth).send({ autonomyLevel });
    await app.close();
  });

  it('booking creates a scheduled trip with a Rate Confirmation PDF', async () => {
    expect(trip.code).toMatch(/^TR-\d{4,}$/);
    expect(trip.status).toBe('scheduled');
    expect(trip.nextStatus).toBe('at_pickup');
    const rc = trip.documents.find((d) => d.type === 'rate_confirmation');
    expect(rc?.mimeType).toBe('application/pdf');

    const { url } = (
      await http()
        .get(`/v1/documents/${rc!.id}/download-url`)
        .set(auth)
        .expect(200)
    ).body as DownloadUrlDto;
    const pdf = await fetch(url);
    expect(pdf.status).toBe(200);
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');
  });

  it('enforces the lifecycle order', async () => {
    const res = await http()
      .post(`/v1/trips/${trip.id}/status`)
      .set(auth)
      .send({ status: 'delivered' })
      .expect(409);
    expect((res.body as ApiErrorDto).code).toBe('TRIP_INVALID_STATE');
  });

  it('tracks progress, GPS and ETA', async () => {
    await http()
      .post(`/v1/trips/${trip.id}/status`)
      .set(auth)
      .send({ status: 'at_pickup' })
      .expect(200);
    await http()
      .post(`/v1/trips/${trip.id}/status`)
      .set(auth)
      .send({ status: 'in_transit' })
      .expect(200);
    const after = (
      await http()
        .post(`/v1/trips/${trip.id}/locations`)
        .set(auth)
        .send({
          points: [
            {
              lat: trip.load.originLat,
              lng: trip.load.originLng,
              recordedAt: new Date(Date.now() - 60_000).toISOString(),
            },
            {
              lat: trip.load.originLat + 0.1,
              lng: trip.load.originLng,
              recordedAt: new Date().toISOString(),
              speedKmh: 90,
            },
          ],
        })
        .expect(200)
    ).body as TripDto;
    expect(after.lastPosition?.lat).toBeCloseTo(trip.load.originLat + 0.1);
    expect(after.remainingKm).toBeGreaterThan(0);
    expect(new Date(after.etaAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('closes the trip only with a POD, then computes the real profit', async () => {
    await http()
      .post(`/v1/trips/${trip.id}/status`)
      .set(auth)
      .send({ status: 'delivered' })
      .expect(200);
    await http()
      .post(`/v1/trips/${trip.id}/expenses`)
      .set(auth)
      .send({ category: 'fuel', amount: 300 })
      .expect(201);
    await http()
      .post(`/v1/trips/${trip.id}/expenses`)
      .set(auth)
      .send({ category: 'tolls', amount: 32.5 })
      .expect(201);

    const noPod = await http()
      .post(`/v1/trips/${trip.id}/complete`)
      .set(auth)
      .expect(400);
    expect((noPod.body as ApiErrorDto).code).toBe('POD_REQUIRED');

    // Presigned upload straight to S3, then confirm.
    const bytes = Buffer.from('%PDF-1.4 fake POD for tests');
    const up = (
      await http()
        .post(`/v1/trips/${trip.id}/documents/upload-url`)
        .set(auth)
        .send({
          type: 'pod',
          mimeType: 'application/pdf',
          sizeBytes: bytes.length,
          fileName: 'pod.pdf',
        })
        .expect(201)
    ).body as UploadUrlDto;
    const missing = await http()
      .post(`/v1/trips/${trip.id}/documents/${up.document.id}/complete`)
      .set(auth)
      .expect(400);
    expect((missing.body as ApiErrorDto).code).toBe('UPLOAD_NOT_FOUND');
    const put = await fetch(up.uploadUrl, {
      method: 'PUT',
      headers: up.headers,
      body: bytes,
    });
    expect(put.status).toBe(200);
    await http()
      .post(`/v1/trips/${trip.id}/documents/${up.document.id}/complete`)
      .set(auth)
      .expect(200);

    const done = (
      await http().post(`/v1/trips/${trip.id}/complete`).set(auth).expect(200)
    ).body as TripDetailDto;
    expect(done.status).toBe('completed');
    expect(done.hasPod).toBe(true);
    expect(done.financials.actualExpenses).toBe(332.5);
    expect(done.financials.actualProfit).toBe(done.financials.rate - 332.5);

    // Real profit is frozen after close-out.
    await http()
      .post(`/v1/trips/${trip.id}/expenses`)
      .set(auth)
      .send({ category: 'fuel', amount: 1 })
      .expect(409);
  });

  it('rates the broker once', async () => {
    const rated = (
      await http()
        .post(`/v1/trips/${trip.id}/broker-rating`)
        .set(auth)
        .send({ stars: 4, comment: 'Smooth' })
        .expect(200)
    ).body as TripDetailDto;
    expect(rated.brokerRating).toEqual({ stars: 4, comment: 'Smooth' });
    const again = await http()
      .post(`/v1/trips/${trip.id}/broker-rating`)
      .set(auth)
      .send({ stars: 5 })
      .expect(409);
    expect((again.body as ApiErrorDto).code).toBe('BROKER_ALREADY_RATED');
  });
});
