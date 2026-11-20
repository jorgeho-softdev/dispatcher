import { UseGuards, applyDecorators } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Per-IP attempt limit (AUTH_RATE_LIMIT_PER_MINUTE) for public endpoints that
 * take credentials. Exceeding it answers 429 RATE_LIMITED. The client IP comes
 * from `trust proxy` (Railway's edge) or, for web users, from the BFF, which
 * forwards the browser's IP in X-Forwarded-For.
 */
export const AuthRateLimit = () => applyDecorators(UseGuards(ThrottlerGuard));
