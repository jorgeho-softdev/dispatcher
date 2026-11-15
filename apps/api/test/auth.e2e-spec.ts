import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

// Requires the dev database (npm run db:up && npm run db:seed).
describe('Auth + tenancy (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects protected routes without a token', async () => {
    await request(app.getHttpServer()).get('/v1/loads').expect(401);
  });

  it('logs in, lists loads and rotates the refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'demo@aidispatcher.dev', password: 'Demo1234!' })
      .expect(200);
    const { accessToken, refreshToken } = login.body as {
      accessToken: string;
      refreshToken: string;
    };

    const loads = await request(app.getHttpServer())
      .get('/v1/loads?limit=5')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect((loads.body as { items: unknown[] }).items.length).toBeGreaterThan(
      0,
    );

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    // Reusing a rotated refresh token is treated as theft.
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('validates input with the shared Zod schemas', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);
  });
});
