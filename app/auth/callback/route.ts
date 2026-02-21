import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getGoogleAutoCreateEmail,
  getGoogleAutoCreateRole,
  isGoogleAutoCreateEnabled,
} from '@/lib/supabase/env'
import { normalizeRequiredEmail } from '@/lib/validation/email'
import { Database } from '@/types/supabase'
import { createActivityLogEntry } from '@/lib/activity-log/logger'

const DEFAULT_REDIRECT_PATH = '/dashboard'

type AccessState = 'inactive' | 'deleted' | 'not_allowed'
type UserRole = Database['public']['Enums']['user_role']
type AccessProfile = Pick<
  Database['public']['Tables']['users']['Row'],
  'id' | 'email' | 'is_active' | 'deleted_at'
>
function getClientIp(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? null
}

function canAutoCreateForEmail(email: string): boolean {
  if (!isGoogleAutoCreateEnabled()) {
    return false
  }

  const allowedEmail = getGoogleAutoCreateEmail()
  if (!allowedEmail) {
    console.warn(
      'ALLOW_GOOGLE_AUTO_CREATE is enabled but GOOGLE_AUTO_CREATE_EMAIL is not set. Auto-create disabled.'
    )
    return false
  }

  return allowedEmail === email
}

function getPreferredFullName(user: { user_metadata?: unknown; email?: string | null }): string {
  const metadata = user.user_metadata

  if (
    metadata &&
    typeof metadata === 'object' &&
    'full_name' in metadata &&
    typeof (metadata as { full_name?: unknown }).full_name === 'string'
  ) {
    const fullName = (metadata as { full_name: string }).full_name.trim()
    if (fullName.length > 0) return fullName
  }

  return user.email?.trim() || ''
}

function getSafeRedirectPath(rawPath: string | null): string {
  if (!rawPath || !rawPath.startsWith('/') || rawPath.startsWith('//')) {
    return DEFAULT_REDIRECT_PATH
  }
  return rawPath
}

function buildLoginRedirect(request: NextRequest, errorCode: string) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('error', errorCode)
  return NextResponse.redirect(loginUrl)
}

async function denyAccess(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof createClient>>,
  errorCode: AccessState,
  shouldDeleteAuthUser = false,
  authUserId?: string
) {
  await supabase.auth.signOut()

  if (shouldDeleteAuthUser && authUserId) {
    try {
      const adminClient = createAdminClient()
      await adminClient.auth.admin.deleteUser(authUserId)
    } catch (error) {
      console.error('Failed to cleanup unauthorized auth user:', error)
    }
  }

  return buildLoginRedirect(request, errorCode)
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const nextPath = getSafeRedirectPath(requestUrl.searchParams.get('redirect'))

  if (!code) {
    return buildLoginRedirect(request, 'oauth_failed')
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return buildLoginRedirect(request, 'oauth_failed')
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return buildLoginRedirect(request, 'oauth_failed')
  }

  const email = normalizeRequiredEmail(user.email || '')
  if (!email) {
    return denyAccess(request, supabase, 'not_allowed', true, user.id)
  }

  const profileResult = await supabase
    .from('users')
    .select('id, email, full_name, is_active, deleted_at')
    .eq('id', user.id)
    .maybeSingle()
  const { error: profileError } = profileResult
  let profile = profileResult.data as unknown as (AccessProfile & { full_name?: string | null }) | null

  if (profileError) {
    return buildLoginRedirect(request, 'callback_error')
  }

  if (!profile) {
    const { data: rawProfileByEmail, error: profileByEmailError } = await supabase
      .from('users')
      .select('id, email, is_active, deleted_at')
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle()
    const profileByEmail = rawProfileByEmail as unknown as AccessProfile | null

    const supabaseAdmin = createAdminClient()

    if (profileByEmailError) {
      return denyAccess(request, supabase, 'not_allowed', true, user.id)
    }

    if (profileByEmail) {
      const { error: syncError } = await supabaseAdmin
        .from('users')
        .update({
          id: user.id,
          email,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', profileByEmail.id)

      if (syncError) {
        return denyAccess(request, supabase, 'not_allowed')
      }

      const { data: rawSyncedProfile, error: syncedProfileError } = await supabase
        .from('users')
        .select('id, email, is_active, deleted_at')
        .eq('id', user.id)
        .maybeSingle()
      const syncedProfile = rawSyncedProfile as unknown as AccessProfile | null

      if (syncedProfileError || !syncedProfile) {
        return denyAccess(request, supabase, 'not_allowed')
      }

      profile = syncedProfile
    } else {
      // Optional bootstrap path: allow one controlled self-provision user via env guard.
      if (!canAutoCreateForEmail(email)) {
        return denyAccess(request, supabase, 'not_allowed', true, user.id)
      }

      const bootstrapRole = getGoogleAutoCreateRole() as UserRole
      const createResult = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          email,
          full_name: getPreferredFullName(user),
          role: bootstrapRole,
          is_active: true,
          module_permissions: {} as never,
          updated_at: new Date().toISOString(),
        } as never)
        .select('id, email, is_active, deleted_at')
        .single()

      const createdProfile = createResult.data as unknown as AccessProfile | null
      if (createResult.error || !createdProfile) {
        return denyAccess(request, supabase, 'not_allowed', true, user.id)
      }

      profile = createdProfile
    }
  }

  if (profile.deleted_at) {
    return denyAccess(request, supabase, 'deleted')
  }

  if (!profile.is_active) {
    return denyAccess(request, supabase, 'inactive')
  }

  const adminClient = createAdminClient()
  const userName = (profile as { full_name?: string | null }).full_name?.trim() || user.email || user.id
  await createActivityLogEntry(
    {
      userId: user.id,
      userName,
      actionType: 'Login',
      moduleName: 'Auth',
      description: 'User logged in successfully',
      status: 'Success',
      ipAddress: getClientIp(request),
    },
    adminClient
  )

  return NextResponse.redirect(new URL(nextPath, request.url))
}
