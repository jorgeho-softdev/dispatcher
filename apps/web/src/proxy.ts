import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { isLocale } from '@dispatcher/i18n';
import { routing } from './i18n/routing';

// 1) Locale: next-intl redirects unprefixed URLs to /<locale>/… (cookie →
//    Accept-Language → default) and remembers the choice.
// 2) Auth (optimistic only): a session cookie must exist. Real authorization
//    happens in the api on every request (JwtAuthGuard + PermissionsGuard).
const intl = createIntlMiddleware(routing);

const REFRESH_COOKIE = 'ad_refresh';
const PUBLIC_PATHS = ['/login', '/signup'];
/** Reachable with or without a session (e.g. accepting an invitation). */
const OPEN_PATHS = ['/invite'];

export function proxy(request: NextRequest) {
  const [, first, ...rest] = request.nextUrl.pathname.split('/');

  if (isLocale(first)) {
    const path = `/${rest.join('/')}`;
    const hasSession = request.cookies.has(REFRESH_COOKIE);
    const isPublic = PUBLIC_PATHS.includes(path);
    if (OPEN_PATHS.includes(path)) return intl(request);

    if (!hasSession && !isPublic) {
      return NextResponse.redirect(new URL(`/${first}/login`, request.url));
    }
    if (hasSession && isPublic) {
      return NextResponse.redirect(new URL(`/${first}`, request.url));
    }
  }
  return intl(request);
}

export const config = {
  // Skip api routes, Next internals and static files.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
