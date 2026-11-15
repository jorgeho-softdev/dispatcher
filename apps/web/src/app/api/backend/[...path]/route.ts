import { NextResponse, type NextRequest } from 'next/server';
import type { AuthResponseDto } from '@dispatcher/shared';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  callApi,
  clearSessionCookies,
  isSameOrigin,
  setSessionCookies,
} from '@/lib/server/session';

// BFF proxy: the browser calls /api/backend/<path>; this handler attaches the
// bearer token from the httpOnly cookie and forwards to the api. Expired
// access tokens are refreshed transparently (one retry).
//
// Only these top-level resources are reachable, so the token can never be
// sent anywhere else. Add a resource here when the api grows.
const ALLOWED_RESOURCES = new Set(['me', 'loads', 'vehicles', 'ai-settings', 'negotiations']);
const SEGMENT = /^[A-Za-z0-9_-]+$/;

type Ctx = RouteContext<'/api/backend/[...path]'>;

async function forward(request: NextRequest, ctx: Ctx): Promise<NextResponse> {
  if (!isSameOrigin(request)) return NextResponse.json({ statusCode: 403, code: 'FORBIDDEN', message: 'Cross-site request' }, { status: 403 });

  const { path } = await ctx.params;
  if (!ALLOWED_RESOURCES.has(path[0] ?? '') || !path.every((s) => SEGMENT.test(s))) {
    return NextResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 });
  }
  const upstreamPath = `/${path.join('/')}${request.nextUrl.search}`;
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();

  const send = (accessToken: string | undefined) =>
    callApi(upstreamPath, {
      method: request.method,
      headers: {
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      },
      body,
    });

  let refreshed: AuthResponseDto | null = null;
  let upstream = await send(request.cookies.get(ACCESS_COOKIE)?.value);

  if (upstream.status === 401) {
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      const r = await callApi('/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (r.ok) {
        refreshed = (await r.json()) as AuthResponseDto;
        upstream = await send(refreshed.accessToken);
      }
    }
  }

  const res = new NextResponse(upstream.status === 204 ? null : await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
  if (refreshed) setSessionCookies(res, refreshed);
  else if (upstream.status === 401) clearSessionCookies(res);
  return res;
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
