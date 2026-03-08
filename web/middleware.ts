import { NextResponse, type NextRequest } from 'next/server';
import {
  AUTH_ROLE_COOKIE,
  AUTH_SESSION_COOKIE,
  canAccessRoute,
  isUserRole,
} from '@/lib/rbac';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const roleCookie = request.cookies.get(AUTH_ROLE_COOKIE)?.value;
  const sessionCookie = request.cookies.get(AUTH_SESSION_COOKIE)?.value;

  if (!sessionCookie || !isUserRole(roleCookie)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('reason', 'unauthorized');
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessRoute(roleCookie, pathname)) {
    return NextResponse.redirect(new URL('/forbidden', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
