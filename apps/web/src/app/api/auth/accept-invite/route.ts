import { NextResponse } from 'next/server';
import { acceptInvitationSchema, type AuthResponseDto } from '@dispatcher/shared';
import { callApi, isSameOrigin, setSessionCookies } from '@/lib/server/session';

/** Accepts an invitation, then signs the new member in (httpOnly session cookies). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ statusCode: 403, code: 'FORBIDDEN', message: 'Cross-site request' }, { status: 403 });
  }
  const parsed = acceptInvitationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ statusCode: 400, code: 'VALIDATION_FAILED', message: 'Invalid input' }, { status: 400 });
  }
  const accepted = await callApi('/invitations/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });
  const body = (await accepted.json().catch(() => ({}))) as { email?: string };
  if (!accepted.ok) return NextResponse.json(body, { status: accepted.status });

  const login = await callApi('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: parsed.data.password }),
  });
  if (!login.ok) return NextResponse.json(await login.json().catch(() => ({})), { status: login.status });
  const auth = (await login.json()) as AuthResponseDto;
  const res = NextResponse.json(auth.me);
  setSessionCookies(res, auth);
  return res;
}
