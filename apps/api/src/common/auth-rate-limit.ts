import { UseGuards, applyDecorators } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Per-IP attempt limit (AUTH_RATE_LIMIT_PER_MINUTE) for public endpoints that
 * take credentials. Exceeding it answers 429 RATE_LIMITED. The client IP is
 * resolved by resolveClientIp (CLIENT_IP_HEADER, e.g. Railway's X-Real-IP);
 * for web users the BFF forwards the browser's IP in that header.
 */
export const AuthRateLimit = () => applyDecorators(UseGuards(ThrottlerGuard));
