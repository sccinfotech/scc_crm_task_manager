'use server'

import crypto from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Database } from '@/types/supabase'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import {
  MODULE_PERMISSION_IDS,
  type ModulePermissions as PermissionMap,
  type AccessLevel,
} from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  EMAIL_VALIDATION_MESSAGE,
  isValidEmailFormat,
  normalizeRequiredEmail,
} from '@/lib/validation/email'
import { createActivityLogEntry } from '@/lib/activity-log/logger'
import { prepareSearchTerm } from '@/lib/supabase/utils'

export type UserRole = Database['public']['Enums']['user_role']
export type ModulePermissions = PermissionMap
type UserRow = Database['public']['Tables']['users']['Row']
type UserInsert = Database['public']['Tables']['users']['Insert']
type UserUpdate = Database['public']['Tables']['users']['Update']

export type UserData = {
  id: string
  email: string
  full_name: string | null
  designation: string | null
  joining_date: string | null
  personal_email: string | null
  personal_mobile_no: string | null
  home_mobile_no: string | null
  address: string | null
  date_of_birth: string | null
  photo_url: string | null
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
  role?: string | null
}

export type CreateUserFormData = {
  email: string
  full_name: string
  designation: string
  joining_date: string
  role: UserRole
  is_active: boolean
  personal_email?: string
  personal_mobile_no: string
  home_mobile_no?: string
  address?: string
  date_of_birth?: string
  photo_url?: string
}

export type UpdateUserFormData = {
  full_name: string
  designation: string
  joining_date: string
  role: UserRole
  is_active: boolean
  personal_email?: string
  personal_mobile_no: string
  home_mobile_no?: string
  address?: string
  date_of_birth?: string
  photo_url?: string
}

export type GetUsersOptions = {
  search?: string
  role?: string
  status?: string
  page?: number
  pageSize?: number
}

type CloudinaryUploadSignature = {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  folder: string
}

const DEFAULT_PAGE_SIZE = 20
const USER_ROLES: UserRole[] = ['admin', 'manager', 'staff', 'client']
const VALID_ACCESS_LEVELS: AccessLevel[] = ['none', 'read', 'write']
const MANAGED_MODULE_IDS = Object.values(MODULE_PERMISSION_IDS)
const USER_PHOTO_CLOUDINARY_FOLDER = 'scc-crm/user-photos'

function getEnvVar(name: string, isPublic = false): string {
  const value = process.env[name]
  if (!value) {
    const visibility = isPublic ? 'public' : 'server-only'
    throw new Error(
      `Missing required ${visibility} environment variable: ${name}. Add it to .env.local and restart the dev server.`
    )
  }

  return value
}

function getCloudinaryConfig() {
  const cloudName = getEnvVar('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', true)
  const apiKey = getEnvVar('NEXT_PUBLIC_CLOUDINARY_API_KEY', true)
  const apiSecret = getEnvVar('CLOUDINARY_API_SECRET', false)

  return { cloudName, apiKey, apiSecret }
}

function signCloudinaryParams(params: Record<string, string | number>, apiSecret: string) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')

  return crypto.createHash('sha1').update(sorted + apiSecret).digest('hex')
}

export async function getUserPhotoUploadSignature(): Promise<{
  data: CloudinaryUploadSignature | null
  error: string | null
}> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to upload a photo.' }
  }

  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'write')
  if (!canWrite) {
    return { data: null, error: 'You do not have permission to upload user photos.' }
  }

  try {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
    const timestamp = Math.floor(Date.now() / 1000)
    const folder = USER_PHOTO_CLOUDINARY_FOLDER
    const signature = signCloudinaryParams({ timestamp, folder }, apiSecret)

    return {
      data: {
        signature,
        timestamp,
        cloudName,
        apiKey,
        folder,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error preparing user photo upload signature:', error)
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to prepare photo upload.',
    }
  }
}

function normalizeTextInput(value: string | undefined | null): string | null {
  if (!value) return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeDateInput(value: string | undefined | null): string | null {
  const normalized = normalizeTextInput(value)
  if (!normalized) return null
  return normalized
}

function isValidUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole)
}

function normalizePermissions(input?: Record<string, unknown> | null): ModulePermissions {
  const normalized: ModulePermissions = {}

  MANAGED_MODULE_IDS.forEach((moduleId) => {
    const raw = input?.[moduleId]
    if (VALID_ACCESS_LEVELS.includes(raw as AccessLevel)) {
      normalized[moduleId] = raw as AccessLevel
      return
    }
    normalized[moduleId] = 'none'
  })

  return normalized
}

function getDefaultPermissions(): ModulePermissions {
  return normalizePermissions({})
}

function toUserData(row: UserRow): UserData {
  return {
    ...row,
    module_permissions: normalizePermissions(row.module_permissions as Record<string, unknown> | null),
  }
}

function validateCommonUserFields(formData: {
  full_name?: string
  designation?: string
  joining_date?: string
  role?: string
  personal_mobile_no?: string
  personal_email?: string
}) {
  const fullName = normalizeTextInput(formData.full_name)
  if (!fullName) {
    return { error: 'Full name is required' }
  }

  const designation = normalizeTextInput(formData.designation)
  if (!designation) {
    return { error: 'Designation is required' }
  }

  const joiningDate = normalizeDateInput(formData.joining_date)
  if (!joiningDate) {
    return { error: 'Joining date is required' }
  }

  const personalMobileNo = normalizeTextInput(formData.personal_mobile_no)
  if (!personalMobileNo) {
    return { error: 'Personal mobile number is required' }
  }

  const role = normalizeTextInput(formData.role)
  if (!role || !isValidUserRole(role)) {
    return { error: 'Role is required' }
  }

  const personalEmail = normalizeRequiredEmail(formData.personal_email || '') || null
  if (personalEmail && !isValidEmailFormat(personalEmail)) {
    return { error: `Personal email: ${EMAIL_VALIDATION_MESSAGE}` }
  }

  return {
    data: {
      fullName,
      designation,
      joiningDate,
      personalMobileNo,
      role,
      personalEmail,
    },
  }
}

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

  let query = supabase
    .from('users')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const searchTerm = prepareSearchTerm(filters?.search)
  if (searchTerm) {
    query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
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

  const normalizedUsers = (users || []).map((row) => toUserData(row))
  return { data: normalizedUsers, totalCount: count ?? 0 }
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
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })

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

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching user:', error)
    return { error: 'Failed to fetch user' }
  }

  return { data: toUserData(user) }
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

  if (currentUser.role !== 'admin') {
    return { error: 'Only admins can add new users' }
  }

  const email = normalizeRequiredEmail(formData.email)
  if (!email) {
    return { error: 'Company email is required' }
  }

  if (!isValidEmailFormat(email)) {
    return { error: EMAIL_VALIDATION_MESSAGE }
  }

  const validation = validateCommonUserFields(formData)
  if (validation.error || !validation.data) {
    return { error: validation.error || 'Invalid user data' }
  }

  const supabaseAdmin = createAdminClient()

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingUser) {
    return { error: 'A user with this company email already exists' }
  }

  // Insert the profile row with a placeholder UUID (auto-generated by the DB via gen_random_uuid()).
  // The real Supabase auth UUID will be synced automatically on the user's first Google OAuth login
  // via the sync_user_auth_id RPC called in the auth callback.
  const userInsert: UserInsert = {
    email,
    full_name: validation.data.fullName,
    designation: validation.data.designation,
    joining_date: validation.data.joiningDate,
    personal_email: validation.data.personalEmail,
    personal_mobile_no: validation.data.personalMobileNo,
    home_mobile_no: normalizeTextInput(formData.home_mobile_no),
    address: normalizeTextInput(formData.address),
    date_of_birth: normalizeDateInput(formData.date_of_birth),
    photo_url: normalizeTextInput(formData.photo_url),
    role: validation.data.role,
    is_active: formData.is_active ?? false,
    module_permissions:
      getDefaultPermissions() as unknown as UserInsert['module_permissions'],
    updated_at: new Date().toISOString(),
  }

  const { data: insertedUser, error: dbError } = await supabaseAdmin
    .from('users')
    .insert(userInsert as never)
    .select('id')
    .single<{ id: string }>()

  if (dbError) {
    console.error('User profile sync error:', dbError)
    return { error: 'Failed to create user profile' }
  }

  const insertedUserId = insertedUser?.id

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Create',
    moduleName: 'User Management',
    recordId: insertedUserId,
    description: `Created user "${validation.data!.fullName}" (${email})`,
    status: 'Success',
  })
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

  const validation = validateCommonUserFields(formData)
  if (validation.error || !validation.data) {
    return { error: validation.error || 'Invalid user data' }
  }

  const supabaseAdmin = createAdminClient()

  const userUpdates: UserUpdate = {
    full_name: validation.data.fullName,
    designation: validation.data.designation,
    joining_date: validation.data.joiningDate,
    personal_email: validation.data.personalEmail,
    personal_mobile_no: validation.data.personalMobileNo,
    home_mobile_no: normalizeTextInput(formData.home_mobile_no),
    address: normalizeTextInput(formData.address),
    date_of_birth: normalizeDateInput(formData.date_of_birth),
    photo_url: normalizeTextInput(formData.photo_url),
    role: validation.data.role,
    is_active: formData.is_active,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update(userUpdates as never)
    .eq('id', id)

  if (error) {
    console.error('Error updating user:', error)
    return { error: 'Failed to update user' }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Update',
    moduleName: 'User Management',
    recordId: id,
    description: `Updated user "${validation.data!.fullName}"`,
    status: 'Success',
  })
  revalidatePath('/dashboard/users')
  return { success: true }
}

export async function updateUserPermissions(userId: string, modulePermissions: ModulePermissions) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return { error: 'You must be logged in to update module permissions' }
  }

  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'write')
  if (!canWrite) {
    return { error: 'You do not have permission to update module permissions' }
  }

  const normalizedPermissions = normalizePermissions(modulePermissions)
  const supabaseAdmin = createAdminClient()

  const permissionsUpdate: UserUpdate = {
    module_permissions:
      normalizedPermissions as unknown as UserUpdate['module_permissions'],
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update(permissionsUpdate as never)
    .eq('id', userId)

  if (error) {
    console.error('Error updating user module permissions:', error)
    return { error: 'Failed to update module permissions' }
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
  const deleteUpdate: UserUpdate = {
    deleted_at: new Date().toISOString(),
    is_active: false,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update(deleteUpdate as never)
    .eq('id', id)

  if (error) {
    console.error('Error deleting user:', error)
    return { error: 'Failed to delete user' }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Delete',
    moduleName: 'User Management',
    recordId: id,
    description: 'Deleted user',
    status: 'Success',
  })
  revalidatePath('/dashboard/users')
  return { success: true }
}
