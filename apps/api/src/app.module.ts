import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { validateEnv, type Env } from './config/env';
import { JwtAuthGuard, PermissionsGuard } from './common/guards';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { LoadsModule } from './modules/loads/loads.module';
import { AiSettingsModule } from './modules/ai-settings/ai-settings.module';
import { NegotiationsModule } from './modules/negotiations/negotiations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { StorageModule } from './modules/storage/storage.module';
import { TripsModule } from './modules/trips/trips.module';
import { TeamModule } from './modules/team/team.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Rate limit for the public credential endpoints only (@AuthRateLimit).
    // In-memory store: correct for one replica; use a Redis store before
    // scaling the api horizontally (docs/deployment.md).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          ttl: 60_000,
          limit: config.get('AUTH_RATE_LIMIT_PER_MINUTE', { infer: true }),
        },
      ],
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const url = new URL(config.get('REDIS_URL', { infer: true }));
        return {
          prefix: config.get('QUEUE_PREFIX', { infer: true }),
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            // 0 = resolve IPv4 and IPv6: Railway's private network is IPv6-only.
            family: 0,
            ...(url.password && { password: decodeURIComponent(url.password) }),
            ...(url.pathname.length > 1 && {
              db: Number(url.pathname.slice(1)),
            }),
          },
        };
      },
    }),
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    VehiclesModule,
    LoadsModule,
    AiSettingsModule,
    NotificationsModule,
    NegotiationsModule,
    TripsModule,
    TeamModule,
    ReportsModule,
  ],
  providers: [
    // Order matters: authenticate first, then authorize.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Uniform ApiErrorDto with a translatable `code` for every error.
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
