import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { canReadModule, canWriteModule, type ModulePermissions } from '@/lib/permissions'
import type { Database } from '@/types/supabase'

type UserRow = Database['public']['Tables']['users']['Row']

export async function getCurrentUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  // Fetch user data from users table
  const { data: userData, error: userError } = await supabase
    .from('users')
    // Fetch all columns to be robust against schema changes (like missing module_permissions)
    // and handle undefined properties gracefully in return object
    .select('*')
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
    role: row.role,
    isActive: row.is_active,
    modulePermissions: (row.module_permissions as ModulePermissions | null) ?? {},
  }
}

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
