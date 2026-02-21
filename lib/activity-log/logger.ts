'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type ActivityActionType = 'Create' | 'Update' | 'Delete' | 'Login' | 'Logout'
export type ActivityLogStatus = 'Success' | 'Failed'

export type CreateActivityLogEntryParams = {
  userId: string
  userName: string
  actionType: ActivityActionType
  moduleName: string
  recordId?: string | null
  description: string
  status?: ActivityLogStatus
  ipAddress?: string | null
}

/**
 * Writes one activity log entry. Does not throw; logs errors to console
 * so that logging never interrupts primary system operations.
 * @param params - Log entry fields
 * @param supabaseClient - Optional client (e.g. admin in auth callback when session cookies aren't set yet)
 */
export async function createActivityLogEntry(
  params: CreateActivityLogEntryParams,
  supabaseClient?: SupabaseClient
): Promise<void> {
  try {
    const supabase = supabaseClient ?? (await createClient())
    const { error } = await supabase.from('activity_log').insert({
      user_id: params.userId,
      user_name: params.userName,
      action_type: params.actionType,
      module_name: params.moduleName,
      record_id: params.recordId ?? null,
      description: params.description,
      status: params.status ?? 'Success',
      ip_address: params.ipAddress ?? null,
    } as never)

    if (error) {
      console.error('[activity-log] insert failed:', error.message)
    }
  } catch (err) {
    console.error('[activity-log] unexpected error:', err)
  }
}
