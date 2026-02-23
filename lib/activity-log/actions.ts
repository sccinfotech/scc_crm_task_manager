'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { createActivityLogEntry } from '@/lib/activity-log/logger'
import { prepareSearchTerm } from '@/lib/supabase/utils'

export type ActivityLogActionType = 'Create' | 'Update' | 'Delete' | 'Login' | 'Logout'
export type ActivityLogStatusFilter = 'Success' | 'Failed' | 'all'

export type ActivityLogEntry = {
  id: string
  user_id: string | null
  user_name: string
  action_type: string
  module_name: string
  record_id: string | null
  description: string
  status: string
  ip_address: string | null
  created_at: string
}

export type GetActivityLogsOptions = {
  fromDate: string // ISO date YYYY-MM-DD
  toDate: string   // ISO date YYYY-MM-DD
  userId?: string | null
  actionType?: ActivityLogActionType | null
  moduleName?: string | null
  status?: ActivityLogStatusFilter
  search?: string | null
  sortField?: 'created_at' | 'user_name' | 'action_type' | 'module_name' | 'status'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export type GetActivityLogsResult = {
  data: ActivityLogEntry[]
  totalCount: number
  error: string | null
}

export async function getActivityLogsPage(options: GetActivityLogsOptions): Promise<GetActivityLogsResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: [], totalCount: 0, error: 'You must be logged in to view activity logs' }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.logs, 'read')
  if (!canRead) {
    return { data: [], totalCount: 0, error: 'You do not have permission to view activity logs' }
  }

  const supabase = await createClient()
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))

  let query = supabase
    .from('activity_log')
    .select('*', { count: 'exact' })

  // Mandatory date range (inclusive): fromDate start of day to toDate end of day
  const fromStart = `${options.fromDate}T00:00:00.000Z`
  const toEnd = `${options.toDate}T23:59:59.999Z`
  query = query.gte('created_at', fromStart).lte('created_at', toEnd)

  if (options.userId?.trim()) {
    query = query.eq('user_id', options.userId.trim())
  }
  if (options.actionType?.trim()) {
    query = query.eq('action_type', options.actionType)
  }
  if (options.moduleName?.trim()) {
    query = query.eq('module_name', options.moduleName.trim())
  }
  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }
  const searchTerm = prepareSearchTerm(options.search)
  if (searchTerm) {
    query = query.or(
      `user_name.ilike.%${searchTerm}%,module_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,record_id.ilike.%${searchTerm}%`
    )
  }

  const sortField = options.sortField ?? 'created_at'
  const sortDirection = options.sortDirection ?? 'desc'
  query = query.order(sortField, { ascending: sortDirection === 'asc' })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Error fetching activity logs:', error)
    return { data: [], totalCount: 0, error: error.message || 'Failed to fetch activity logs' }
  }

  return {
    data: (data || []) as ActivityLogEntry[],
    totalCount: count ?? 0,
    error: null,
  }
}

export type DeleteActivityLogsByDateRangeResult = {
  error: string | null
  deletedCount?: number
}

export async function deleteActivityLogsByDateRange(
  fromDate: string,
  toDate: string
): Promise<DeleteActivityLogsByDateRangeResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'You must be logged in to delete activity logs' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.logs, 'write')
  if (!canWrite) {
    return { error: 'You do not have permission to delete activity logs' }
  }

  const fromTrimmed = fromDate?.trim()
  const toTrimmed = toDate?.trim()
  if (!fromTrimmed || !toTrimmed) {
    return { error: 'From date and to date are required' }
  }

  const fromStart = `${fromTrimmed}T00:00:00.000Z`
  const toEnd = `${toTrimmed}T23:59:59.999Z`

  const supabase = await createClient()

  const { data: toDelete, error: fetchError } = await supabase
    .from('activity_log')
    .select('id')
    .gte('created_at', fromStart)
    .lte('created_at', toEnd)

  if (fetchError) {
    console.error('Error fetching logs for deletion:', fetchError)
    return { error: fetchError.message || 'Failed to fetch logs for deletion' }
  }

  const ids = (toDelete || []).map((row: { id: string }) => row.id)
  if (ids.length === 0) {
    return { error: null, deletedCount: 0 }
  }

  const { error: deleteError } = await supabase.from('activity_log').delete().in('id', ids)

  if (deleteError) {
    console.error('Error deleting activity logs:', deleteError)
    return { error: deleteError.message || 'Failed to delete activity logs' }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Delete',
    moduleName: 'Logs',
    description: `Deleted ${ids.length} activity log(s) from ${fromTrimmed} to ${toTrimmed}`,
    status: 'Success',
  })

  return { error: null, deletedCount: ids.length }
}

