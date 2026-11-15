import 'server-only';
import type { AuthResponseDto } from '@dispatcher/shared';
import type { NextResponse } from 'next/server';

// Session = the api's access + refresh tokens, kept in httpOnly cookies so
// browser JavaScript can never read them (XSS can't steal the session).
// See docs/adr/0007-web-bff-session.md.

export const ACCESS_COOKIE = 'ad_access';
export const REFRESH_COOKIE = 'ad_refresh';
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

export const API_URL = (process.env.API_URL ?? 'http://localhost:4000/v1').replace(/\/$/, '');

const baseCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function setSessionCookies(res: NextResponse, auth: Pick<AuthResponseDto, 'accessToken' | 'refreshToken' | 'expiresIn'>) {
  res.cookies.set(ACCESS_COOKIE, auth.accessToken, { ...baseCookie, maxAge: auth.expiresIn });
  res.cookies.set(REFRESH_COOKIE, auth.refreshToken, { ...baseCookie, maxAge: REFRESH_MAX_AGE });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, '', { ...baseCookie, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...baseCookie, maxAge: 0 });
}

/** Rejects cross-site mutating requests (CSRF defence on top of SameSite=Lax). */
export function isSameOrigin(request: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

/**
 * Calls the api. A network failure (api down, DNS, refused connection) becomes
 * a 503 JSON response instead of an unhandled exception, so every BFF route
 * degrades gracefully and the UI can show "server unavailable".
 */
export async function callApi(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, { ...init, redirect: 'error', cache: 'no-store' });
  } catch (error) {
    console.error(`[bff] api unreachable at ${API_URL}${path}`, error);
    return Response.json({ statusCode: 503, code: 'API_UNAVAILABLE', message: 'API unavailable' }, { status: 503 });
  }
}
