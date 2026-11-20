import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthResponseDto } from '@dispatcher/shared';
import type { PrismaService } from '../src/prisma/prisma.service';

// Self sign-up + the per-IP auth rate limit. A low limit is set BEFORE the
// app module is imported (ConfigModule validates the env at import time).
const LIMIT = 3;

describe('Sign-up and auth rate limit (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `signup-${Date.now()}@e2e.test`;

  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT_PER_MINUTE = String(LIMIT);
    const { AppModule } = await import('../src/app.module.js');
    const { PrismaService } = await import('../src/prisma/prisma.service.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: true },
    });
    if (user) {
      const orgIds = user.memberships.map((m) => m.organizationId);
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await app.close();
  });

  it('creates the user as owner of a new organization and signs them in', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        name: 'Sign Up Test',
        companyName: 'Sign Up Transport',
        email,
        password: 'Signup1234!',
        locale: 'fr',
      })
      .expect(201);
    const auth = res.body as AuthResponseDto;
    expect(auth.accessToken).toBeTruthy();
    expect(auth.me.role).toBe('owner');
    expect(auth.me.organization.name).toBe('Sign Up Transport');

    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('authorization', `Bearer ${auth.accessToken}`)
      .expect(200);
    expect((me.body as { user: { locale: string } }).user.locale).toBe('fr');
  });

  it('rejects an email that is already registered', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        name: 'Dup',
        companyName: 'Dup Co',
        email,
        password: 'Signup1234!',
      })
      .expect(409);
    expect(res.body).toMatchObject({ code: 'AUTH_EMAIL_TAKEN' });
  });

  it(`blocks the ${LIMIT + 1}th login attempt per minute from one IP with 429 RATE_LIMITED`, async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('x-forwarded-for', '203.0.113.7')
        .send({ email, password: 'wrong-password' });
    for (let i = 0; i < LIMIT; i++) await attempt().expect(401);
    const blocked = await attempt().expect(429);
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
    });
  });
});
