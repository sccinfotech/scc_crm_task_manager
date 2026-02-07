'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Database } from '@/types/supabase'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

export type UserRole = Database['public']['Enums']['user_role']
export type ModulePermissions = Record<string, 'read' | 'write' | 'none'>

export type UserData = {
    id: string
    email: string
    full_name: string | null
    role: UserRole
    is_active: boolean
    module_permissions: ModulePermissions
    created_at: string
    deleted_at?: string | null
}

export type StaffSelectOption = {
    id: string
    full_name: string | null
    email: string | null
}

export type CreateUserFormData = {
    email: string
    password: string
    full_name: string
    role: UserRole
    module_permissions: ModulePermissions
}

export type UpdateUserFormData = {
    full_name?: string
    role?: UserRole
    is_active?: boolean
    module_permissions?: ModulePermissions
    password?: string // Optional password update
}

export type GetUsersOptions = {
    search?: string
    role?: string
    status?: string
    page?: number
    pageSize?: number
}

const DEFAULT_PAGE_SIZE = 20

export async function getUsers(filters?: GetUsersOptions) {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
        return { error: 'You must be logged in to view users' }
    }

    const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'read')
    if (!canRead) {
        return { error: 'You do not have permission to view users' }
    }

    const supabase = await createClient()
    const page = Math.max(1, filters?.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? DEFAULT_PAGE_SIZE))

    let query = (supabase
        .from('users')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false }) as any)

    if (filters?.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
    }

    if (filters?.role && filters.role !== 'all') {
        query = query.eq('role', filters.role)
    }

    if (filters?.status && filters.status !== 'all') {
        query = query.eq('is_active', filters.status === 'active')
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const { data: users, error, count } = await query.range(from, to)

    if (error) {
        console.error('Error fetching users:', error)
        return { error: 'Failed to fetch users' }
    }

    return { data: users as UserData[], totalCount: count ?? 0 }
}

export async function getStaffForSelect(): Promise<{ data: StaffSelectOption[]; error: string | null }> {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
        return { data: [], error: 'You must be logged in to view staff' }
    }

    const isAdminManager = currentUser.role === 'admin' || currentUser.role === 'manager'
    const canWriteProjects = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')

    if (!isAdminManager && !canWriteProjects) {
        return { data: [], error: 'You do not have permission to view staff' }
    }

    const supabase = await createClient()
    const { data, error } = await (supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'staff')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('full_name', { ascending: true }) as any)

    if (error) {
        console.error('Error fetching staff list:', error)
        return { data: [], error: error.message || 'Failed to fetch staff list' }
    }

    return { data: (data || []) as StaffSelectOption[], error: null }
}

export async function getUser(id: string) {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
        return { error: 'You must be logged in to view users' }
    }

    const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'read')
    if (!canRead) {
        return { error: 'You do not have permission to view users' }
    }

    const supabase = await createClient()

    const { data: user, error } = await (supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single() as any)

    if (error) {
        console.error('Error fetching user:', error)
        return { error: 'Failed to fetch user' }
    }

    return { data: user as UserData }
}

export async function createUser(formData: CreateUserFormData) {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
        return { error: 'You must be logged in to create users' }
    }

    const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'write')
    if (!canWrite) {
        return { error: 'You do not have permission to create users' }
    }

    const supabaseAdmin = createAdminClient()

    // 1. Create user in Supabase Auth
    // We pass NO metadata initially to make the trigger as "light" as possible
    // This prevents the trigger from trying to cast roles that might not exist yet.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
    })

    if (authError || !authData.user) {
        console.error('Auth Error Details:', authError)
        // If it's a database error, we want the user to see the EXACT details (e.g., which column or type is failing)
        const isDbError = authError?.message?.includes('Database error')
        return {
            error: isDbError
                ? `Database Error: ${authError?.message}. (Check if your users table and user_role enum are up to date)`
                : (authError?.message || 'Failed to create user account')
        }
    }

    // 2. Explicitly update/insert the profile
    // Since the trigger might have failed OR we want to ensure specific data,
    // we use an "upsert" to be safe.
    const { error: dbError } = await supabaseAdmin
        .from('users')
        .upsert({
            id: authData.user.id,
            email: formData.email,
            role: formData.role,
            module_permissions: formData.module_permissions as any,
            full_name: formData.full_name,
            is_active: true,
            updated_at: new Date().toISOString()
        } as any)

    if (dbError) {
        console.error('Profile Sync Error:', dbError)
        // Cleanup the auth user since we couldn't create the profile
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return { error: 'Auth account created, but profile sync failed. Please check DB roles.' }
    }

    revalidatePath('/dashboard/users')
    return { success: true }
}

export async function updateUser(id: string, formData: UpdateUserFormData) {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
        return { error: 'You must be logged in to update users' }
    }

    const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'write')
    if (!canWrite) {
        return { error: 'You do not have permission to update users' }
    }
    const supabaseAdmin = createAdminClient()

    const updates: any = {
        ...formData,
        updated_at: new Date().toISOString(),
    }

    // Remove password from direct update to `users` table (it's in auth)
    delete updates.password

    const { error } = await supabaseAdmin
        .from('users')
        .update(updates as never)
        .eq('id', id)

    if (error) {
        console.error('Error updating user:', error)
        return { error: 'Failed to update user' }
    }

    // If password update is needed, we need Admin API or user needs to allow it.
    // We can use Admin API here if password is provided
    if (formData.password) {
        const supabaseAdmin = createAdminClient()
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(id, { password: formData.password })
        if (pwError) {
            console.error('Error updating password:', pwError)
            return { error: 'Failed to update password' }
        }
    }

    revalidatePath('/dashboard/users')
    return { success: true }
}

export async function deleteUser(id: string) {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
        return { error: 'You must be logged in to delete users' }
    }

    const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'write')
    if (!canWrite) {
        return { error: 'You do not have permission to delete users' }
    }
    const supabaseAdmin = createAdminClient()

    // Soft delete: set deleted_at and is_active to false
    const { error } = await supabaseAdmin
        .from('users')
        .update({
            deleted_at: new Date().toISOString(),
            is_active: false
        } as never)
        .eq('id', id)

    if (error) {
        console.error('Error deleting user:', error)
        return { error: 'Failed to delete user' }
    }

    // Optionally sign out the user sessions if they're logged in
    // Note: This won't immediately kick them out if they have a valid session, 
    // but they won't be able to log in again or perform actions if RLS checks for deleted_at.

    revalidatePath('/dashboard/users')
    return { success: true }
}
export async function changeUserPassword(userId: string, password: string) {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
        return { error: 'You must be logged in to change passwords' }
    }

    const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'write')
    if (!canWrite) {
        return { error: 'You do not have permission to change passwords' }
    }
    const supabaseAdmin = createAdminClient()

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password
    })

    if (error) {
        console.error('Error changing password:', error)
        return { error: error.message || 'Failed to change password' }
    }

    return { success: true }
}
