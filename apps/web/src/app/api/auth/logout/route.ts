import { NextResponse, type NextRequest } from 'next/server';
import { REFRESH_COOKIE, callApi, clearSessionCookies, isSameOrigin } from '@/lib/server/session';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ statusCode: 403, code: 'FORBIDDEN', message: 'Cross-site request' }, { status: 403 });

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    // Revoke server-side too; a failure here must not keep the user logged in.
    await callApi('/auth/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  const res = new NextResponse(null, { status: 204 });
  clearSessionCookies(res);
  return res;
}
