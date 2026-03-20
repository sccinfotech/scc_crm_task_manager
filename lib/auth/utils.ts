import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { canReadModule, canWriteModule, type ModulePermissions } from '@/lib/permissions'
import type { Database } from '@/types/supabase'

type UserRow = Database['public']['Tables']['users']['Row']

async function getCurrentUserImpl() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  // Fetch user data from users table (only columns needed for auth/session)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, photo_url, role, is_active, module_permissions, deleted_at')
    .eq('id', user.id)
    .single()

  if (userError || !userData) {
    console.error('User consistency error:', userError)
    // If Auth thinks we are logged in but DB disagrees (or errors),
    // we must sign out to prevent middleware -> page -> login -> middleware redirect loop
    await supabase.auth.signOut()
    return null
  }

  const row = userData as UserRow
  if (row.deleted_at) {
    await supabase.auth.signOut()
    redirect('/login?error=deleted')
  }

  if (!row.is_active) {
    // Inactive user - sign them out
    await supabase.auth.signOut()
    redirect('/login?error=inactive')
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    role: row.role,
    isActive: row.is_active,
    modulePermissions: (row.module_permissions as ModulePermissions | null) ?? {},
  }
}

/** Request-scoped cache: deduplicates getCurrentUser calls within a single request */
export const getCurrentUser = cache(getCurrentUserImpl)

export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

export async function requireRole(allowedRoles: ('admin' | 'manager' | 'user' | 'staff' | 'client')[]) {
  const user = await requireAuth()

  if (!allowedRoles.includes(user.role)) {
    redirect('/dashboard?error=unauthorized')
  }

  return user
}

export async function hasPermission(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  module: string,
  requiredLevel: 'read' | 'write'
): Promise<boolean> {
  if (!user) return false
  const context = { role: user.role, modulePermissions: user.modulePermissions }

  if (requiredLevel === 'read') return canReadModule(context, module)
  if (requiredLevel === 'write') return canWriteModule(context, module)

  return false
}
