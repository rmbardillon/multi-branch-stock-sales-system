import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login'];

// Routes that require authentication (protected)
const protectedPrefixes = ['/', '/branches', '/stock-items', '/inventory', '/sales', '/transfers', '/reports', '/users', '/audit'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for auth token in cookies or a custom header
  // In our case we use localStorage on the client, but Next.js middleware
  // can check a cookie for SSR route protection
  const token = request.cookies.get('auth_token')?.value;

  // Allow public routes for unauthenticated users
  if (publicRoutes.some((route) => pathname === route)) {
    // If user is already authenticated and visits login, redirect to dashboard
    if (token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // API routes and static files pass through
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // For protected routes, check for token
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
