import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type {
  AiPerformanceDto,
  AiSettingsDto,
  ApiErrorDto,
  AuthResponseDto,
  FleetLiveDto,
  InvitationDto,
  InvitationPreviewDto,
  LoadListDto,
  MemberDto,
  NegotiationDetailDto,
  NegotiationStatus,
  ReportSummaryDto,
  TripDetailDto,
  TripDto,
} from '@dispatcher/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Phase 4: invitations, role rules, driver scoping, live map and reports.
describe('Team & reports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: { authorization: string };
  let original: AiSettingsDto;
  const stamp = Date.now();
  const driverEmail = `driver-${stamp}@e2e.test`;
  const managerEmail = `manager-${stamp}@e2e.test`;
  let loadId: string | undefined;

  const http = () => request(app.getHttpServer());
  const login = async (email: string, password: string) => {
    const res = await http()
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return {
      authorization: `Bearer ${(res.body as AuthResponseDto).accessToken}`,
    };
  };
  const invite = async (email: string, role: 'driver' | 'fleet_manager') => {
    const inv = (
      await http()
        .post('/v1/invitations')
        .set(owner)
        .send({ email, role })
        .expect(201)
    ).body as InvitationDto;
    return new URL(inv.inviteUrl!).searchParams.get('token')!;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    prisma = app.get(PrismaService);
    owner = await login('demo@aidispatcher.dev', 'Demo1234!');
    original = (await http().get('/v1/ai-settings').set(owner))
      .body as AiSettingsDto;
  });

  afterAll(async () => {
    if (loadId) {
      await prisma.trip.deleteMany({ where: { loadId } });
      await prisma.negotiation.deleteMany({ where: { loadId } });
      await prisma.load.update({
        where: { id: loadId },
        data: { status: 'available' },
      });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [driverEmail, managerEmail] } },
    });
    await prisma.invitation.deleteMany({
      where: { email: { in: [driverEmail, managerEmail] } },
    });
    await http()
      .patch('/v1/ai-settings')
      .set(owner)
      .send({ autonomyLevel: original.autonomyLevel });
    await app.close();
  });

  it('invites a driver by link: preview → accept → login, single use', async () => {
    const token = await invite(driverEmail, 'driver');
    const preview = (
      await http().get(`/v1/invitations/preview?token=${token}`).expect(200)
    ).body as InvitationPreviewDto;
    expect(preview).toMatchObject({ email: driverEmail, role: 'driver' });

    await http()
      .post('/v1/invitations/accept')
      .send({
        token,
        name: 'Gurpreet Driver',
        password: 'Driver1234!',
        locale: 'pa',
      })
      .expect(200);
    const reuse = await http()
      .post('/v1/invitations/accept')
      .send({ token, name: 'Second Try', password: 'Whatever123' })
      .expect(400);
    expect((reuse.body as ApiErrorDto).code).toBe('INVITATION_INVALID');

    const driver = await login(driverEmail, 'Driver1234!');
    const me = (await http().get('/v1/me').set(driver).expect(200)).body as {
      role: string;
      user: { locale: string };
    };
    expect(me.role).toBe('driver');
    expect(me.user.locale).toBe('pa');
  });

  it('drivers have no access to finances or team management', async () => {
    const driver = await login(driverEmail, 'Driver1234!');
    const now = new Date();
    const range = `from=${new Date(now.getTime() - 86_400_000).toISOString()}&to=${now.toISOString()}`;
    await http().get(`/v1/reports/summary?${range}`).set(driver).expect(403);
    await http()
      .post('/v1/invitations')
      .set(driver)
      .send({ email: 'x@e2e.test', role: 'driver' })
      .expect(403);
  });

  it('enforces role rules: no self-change, only owners touch ownership', async () => {
    const members = (await http().get('/v1/members').set(owner).expect(200))
      .body as MemberDto[];
    const self = members.find((m) => m.isSelf)!;
    const selfChange = await http()
      .patch(`/v1/members/${self.id}`)
      .set(owner)
      .send({ role: 'driver' })
      .expect(400);
    expect((selfChange.body as ApiErrorDto).code).toBe('CANNOT_CHANGE_SELF');

    const token = await invite(managerEmail, 'fleet_manager');
    await http()
      .post('/v1/invitations/accept')
      .send({ token, name: 'Fleet Manager', password: 'Manager1234!' })
      .expect(200);
    const manager = await login(managerEmail, 'Manager1234!');
    const driverMember = (
      (await http().get('/v1/members').set(manager)).body as MemberDto[]
    ).find((m) => m.email === driverEmail)!;
    const promote = await http()
      .patch(`/v1/members/${driverMember.id}`)
      .set(manager)
      .send({ role: 'owner' })
      .expect(403);
    expect((promote.body as ApiErrorDto).code).toBe('FORBIDDEN');
    await http()
      .patch(`/v1/members/${driverMember.id}`)
      .set(manager)
      .send({ role: 'dispatcher' })
      .expect(200);
    await http()
      .patch(`/v1/members/${driverMember.id}`)
      .set(manager)
      .send({ role: 'driver' })
      .expect(200);
  });

  it('drivers only see trips assigned to them', async () => {
    await http()
      .patch('/v1/ai-settings')
      .set(owner)
      .send({ autonomyLevel: 'semi_auto' });
    const { items } = (
      await http().get('/v1/loads?view=recommended&limit=20').set(owner)
    ).body as LoadListDto;
    const active = (
      await http().get('/v1/negotiations?filter=active').set(owner)
    ).body as NegotiationDetailDto[];
    const busy = new Set(active.map((n) => n.load.id));
    loadId = items.find((l) => !busy.has(l.id))!.id;
    const { id } = (
      await http()
        .post('/v1/negotiations')
        .set(owner)
        .send({ loadId })
        .expect(201)
    ).body as NegotiationDetailDto;
    const waitFor = async (statuses: NegotiationStatus[]) => {
      for (let i = 0; i < 100; i++) {
        const n = (await http().get(`/v1/negotiations/${id}`).set(owner))
          .body as NegotiationDetailDto;
        if (statuses.includes(n.status)) return n;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('timeout');
    };
    await waitFor(['awaiting_booking_approval']);
    await http()
      .post(`/v1/negotiations/${id}/approve-booking`)
      .set(owner)
      .expect(200);
    const booked = await waitFor(['booked']);

    const driver = await login(driverEmail, 'Driver1234!');
    expect(
      ((await http().get('/v1/trips').set(driver)).body as TripDto[]).length,
    ).toBe(0);
    await http().get(`/v1/trips/${booked.tripId}`).set(driver).expect(404);

    const driverId = (
      (await http().get('/v1/members').set(owner)).body as MemberDto[]
    ).find((m) => m.email === driverEmail)!.userId;
    const assigned = (
      await http()
        .post(`/v1/trips/${booked.tripId}/driver`)
        .set(owner)
        .send({ driverId })
        .expect(200)
    ).body as TripDetailDto;
    expect(assigned.driver.name).toBe('Gurpreet Driver');
    expect(
      ((await http().get('/v1/trips').set(driver)).body as TripDto[]).map(
        (t) => t.id,
      ),
    ).toEqual([booked.tripId]);

    const live = (await http().get('/v1/fleet/live').set(owner).expect(200))
      .body as FleetLiveDto;
    expect(live.trips.some((t) => t.id === booked.tripId)).toBe(true);
    expect(live.vehicles.some((v) => v.onTrip)).toBe(true);
  });

  it('reports: summary, CSV and AI performance', async () => {
    const to = new Date(Date.now() + 86_400_000);
    const from = new Date(to.getTime() - 90 * 86_400_000);
    const range = `from=${from.toISOString()}&to=${to.toISOString()}`;

    const summary = (
      await http()
        .get(`/v1/reports/summary?${range}&groupBy=month`)
        .set(owner)
        .expect(200)
    ).body as ReportSummaryDto;
    expect(summary.currency).toBe('CAD');
    expect(summary.totals.profit).toBeCloseTo(
      summary.totals.revenue - summary.totals.expenses,
      2,
    );
    expect(summary.groups.reduce((s, g) => s + g.trips, 0)).toBe(
      summary.totals.trips,
    );

    const csv = await http()
      .get(`/v1/reports/trips.csv?${range}`)
      .set(owner)
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.startsWith('﻿trip,completed_at,')).toBe(true);

    const ai = (
      await http().get(`/v1/reports/ai?${range}`).set(owner).expect(200)
    ).body as AiPerformanceDto;
    expect(ai.negotiations).toBeGreaterThan(0);
    expect(ai.closeRatePct).toBeGreaterThanOrEqual(0);

    const bad = await http()
      .get(
        `/v1/reports/summary?from=${to.toISOString()}&to=${from.toISOString()}`,
      )
      .set(owner)
      .expect(400);
    expect((bad.body as ApiErrorDto).code).toBe('VALIDATION_FAILED');
  });
});
