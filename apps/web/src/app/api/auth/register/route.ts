import { NextResponse } from 'next/server';
import { registerSchema, type AuthResponseDto } from '@dispatcher/shared';
import { callApi, clientIpHeaders, isSameOrigin, setSessionCookies } from '@/lib/server/session';

/** Self sign-up: creates the user + their organization (as owner) and signs them in. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ statusCode: 403, code: 'FORBIDDEN', message: 'Cross-site request' }, { status: 403 });
  }
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ statusCode: 400, code: 'VALIDATION_FAILED', message: 'Invalid input' }, { status: 400 });
  }

  const upstream = await callApi('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...clientIpHeaders(request) },
    body: JSON.stringify(parsed.data),
  });
  const body = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return NextResponse.json(body, { status: upstream.status });

  const auth = body as AuthResponseDto;
  // Only the profile goes to the browser; tokens stay in httpOnly cookies.
  const res = NextResponse.json(auth.me, { status: 201 });
  setSessionCookies(res, auth);
  return res;
}
