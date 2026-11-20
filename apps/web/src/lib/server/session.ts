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
  return origin === publicOrigin(request);
}

/**
 * The origin the BROWSER used. Behind a proxy (Railway, any load balancer)
 * `request.url` is the container's internal address (http://0.0.0.0:3000),
 * so the public host and scheme come from the forwarded headers.
 */
function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const first = (v: string | null) => v?.split(',')[0]?.trim() || null;
  const host = first(request.headers.get('x-forwarded-host')) ?? request.headers.get('host') ?? url.host;
  const proto = first(request.headers.get('x-forwarded-proto')) ?? url.protocol.replace(/:$/, '');
  return `${proto}://${host}`;
}

/**
 * Calls the api. A network failure (api down, DNS, refused connection) becomes
 * a 503 JSON response instead of an unhandled exception, so every BFF route
 * degrades gracefully and the UI can show "server unavailable".
 */
/**
 * The browser's IP, forwarded to the api so its per-IP auth rate limit sees
 * each user instead of the web server. Railway's edge puts the real client IP
 * in X-Real-IP (overwriting anything the client sent); without it, the last
 * X-Forwarded-For entry (added by the nearest proxy) is used. The api reads
 * it through CLIENT_IP_HEADER=x-real-ip.
 */
export function clientIpHeaders(request: Request): Record<string, string> {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean);
  const ip = request.headers.get('x-real-ip')?.trim() || forwarded?.at(-1);
  return ip ? { 'x-real-ip': ip, 'x-forwarded-for': ip } : {};
}

export async function callApi(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, { ...init, redirect: 'error', cache: 'no-store' });
  } catch (error) {
    console.error(`[bff] api unreachable at ${API_URL}${path}`, error);
    return Response.json({ statusCode: 503, code: 'API_UNAVAILABLE', message: 'API unavailable' }, { status: 503 });
  }
}
