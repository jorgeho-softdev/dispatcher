import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { ApiErrorDto, MeDto } from '@dispatcher/shared';
import { AppModule } from '../src/app.module';

// Errors carry a stable `code` the clients translate; the user's language is persisted.
describe('Error codes + user locale (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'demo@aidispatcher.dev', password: 'Demo1234!' });
    token = (res.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    // Leave the demo user as seeded.
    await request(app.getHttpServer())
      .patch('/v1/me')
      .set('authorization', `Bearer ${token}`)
      .send({ locale: 'es' });
    await app.close();
  });

  it.each([
    [
      'wrong password',
      { email: 'demo@aidispatcher.dev', password: 'nope' },
      401,
      'AUTH_INVALID_CREDENTIALS',
    ],
    ['invalid body', { email: 'x', password: '' }, 400, 'VALIDATION_FAILED'],
  ])('login with %s returns code', async (_label, body, status, code) => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send(body)
      .expect(status);
    expect((res.body as ApiErrorDto).code).toBe(code);
  });

  it('missing token returns AUTH_TOKEN_MISSING', async () => {
    const res = await request(app.getHttpServer()).get('/v1/me').expect(401);
    expect((res.body as ApiErrorDto).code).toBe('AUTH_TOKEN_MISSING');
  });

  it('unknown resource returns NOT_FOUND', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/vehicles/00000000-0000-4000-8000-000000000000')
      .set('authorization', `Bearer ${token}`)
      .expect(404);
    expect((res.body as ApiErrorDto).code).toBe('NOT_FOUND');
  });

  it('persists a supported locale and rejects unsupported ones', async () => {
    const ok = await request(app.getHttpServer())
      .patch('/v1/me')
      .set('authorization', `Bearer ${token}`)
      .send({ locale: 'pa' })
      .expect(200);
    expect((ok.body as MeDto).user.locale).toBe('pa');

    const bad = await request(app.getHttpServer())
      .patch('/v1/me')
      .set('authorization', `Bearer ${token}`)
      .send({ locale: 'xx' })
      .expect(400);
    expect((bad.body as ApiErrorDto).code).toBe('VALIDATION_FAILED');
  });
});
