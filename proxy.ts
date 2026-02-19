import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request)

  const { pathname } = request.nextUrl

  // Protected routes - require authentication
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return Response.redirect(url)
    }

    // Check if user is active (future-ready)
    // This will be implemented when we fetch user data from users table
    return supabaseResponse
  }

  // Auth routes - redirect if already authenticated
  if (pathname.startsWith('/login')) {
    if (user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return Response.redirect(url)
    }
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
