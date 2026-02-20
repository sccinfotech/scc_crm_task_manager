import { type NextRequest, NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { updateSession } from '@/lib/supabase/middleware'
import { Database } from '@/types/supabase'

type UserAccessState = 'allowed' | 'inactive' | 'deleted' | 'not_allowed'
type UserAccessRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'id' | 'is_active' | 'deleted_at'
>

async function resolveUserAccessState(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserAccessState> {
  const { data: rawUserRow, error } = await supabase
    .from('users')
    .select('id, is_active, deleted_at')
    .eq('id', userId)
    .maybeSingle()
  const userRow = rawUserRow as UserAccessRow | null

  if (error || !userRow) {
    return 'not_allowed'
  }

  if (userRow.deleted_at) {
    return 'deleted'
  }

  if (!userRow.is_active) {
    return 'inactive'
  }

  return 'allowed'
}

export async function proxy(request: NextRequest) {
  const { user, supabase, supabaseResponse } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    const accessState = await resolveUserAccessState(supabase, user.id)
    if (accessState !== 'allowed') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', accessState)
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  if (pathname.startsWith('/login')) {
    if (!user) {
      return supabaseResponse
    }

    const accessState = await resolveUserAccessState(supabase, user.id)
    if (accessState === 'allowed') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    if (request.nextUrl.searchParams.get('error') !== accessState) {
      const url = request.nextUrl.clone()
      url.searchParams.set('error', accessState)
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
