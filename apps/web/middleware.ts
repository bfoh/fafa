import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';

/**
 * Known top-level routes that are NOT tenant slugs.
 */
const KNOWN_PATHS = new Set([
  'dashboard',
  'login',
  'register',
  'forgot-password',
  'admin',
  'api',
  '_next',
  'favicon.ico',
  'sounds',
  'images',
  'for-restaurants',
]);

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient(req, res);
  const { pathname } = req.nextUrl;

  // Expose the path to server components (auth layout uses it to force Didi
  // branding on /register).
  res.headers.set('x-pathname', pathname);

  // Refresh session (important for Supabase auth)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  // ── 1. Dashboard routes: /dashboard/* ──
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/settings')) {
    if (!session) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Extract tenant_id from JWT claims
    const tenantId =
      session.user.app_metadata?.tenant_id ||
      (session as unknown as { user: { user_metadata: Record<string, string> } }).user.user_metadata?.tenant_id;

    if (tenantId) {
      res.headers.set('x-tenant-id', tenantId);
    }

    return res;
  }

  // ── 2. Admin routes: /admin/* ──
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Check platform admin (done via API call in the page, not middleware)
    return res;
  }

  // ── 3. Auth routes: /login, /register ──
  if (pathname === '/login' || pathname === '/register') {
    if (session) {
      // Already logged in, redirect to dashboard
      const tenantId = session.user.app_metadata?.tenant_id;
      if (tenantId) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }
    return res;
  }

  // ── 4. Storefront routes: /[slug]/* ──
  if (firstSegment && !KNOWN_PATHS.has(firstSegment)) {
    // This is a potential storefront URL
    res.headers.set('x-tenant-slug', firstSegment);
    return res;
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sounds|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
