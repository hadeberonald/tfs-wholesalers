import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths that don't require branch selection
  const publicPaths = [
    '/select-branch',
    '/api',
    '/_next',
    '/static',
    '/favicon.ico',
    '/login',
    '/register',
    '/super-admin',
  ];

  // Check if path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  if (isPublicPath) {
    return NextResponse.next();
  }

  // If user is on root path, redirect to branch selector
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/select-branch', request.url));
  }

  // Check if path is a branch path (e.g., /vryheid, /pmb, /durban)
  const branchMatch = pathname.match(/^\/([^\/]+)(\/.*)?$/);
  
  if (branchMatch) {
    const [, branchSlug, subPath] = branchMatch;
    
    // Valid branch paths - allow through
    if (branchSlug && !publicPaths.some(path => `/${branchSlug}`.startsWith(path))) {
      return NextResponse.next();
    }
  }

  // For any other path, redirect to branch selector
  return NextResponse.redirect(new URL('/select-branch', request.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};