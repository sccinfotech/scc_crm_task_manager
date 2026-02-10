'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'

export type NotificationItem = {
  id: string
  user_id: string
  project_id: string | null
  task_id: string | null
  type: string
  title: string
  body: string | null
  meta: Record<string, any> | null
  is_read: boolean
  read_at: string | null
  created_by: string | null
  created_at: string
}

type ActionResult<T> = { data: T | null; error: string | null }

export async function getNotifications(limit = 30): Promise<ActionResult<NotificationItem[]>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view notifications.' }
  }

  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('notifications')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching notifications:', error)
    return { data: null, error: error.message || 'Failed to fetch notifications.' }
  }

  return { data: (data as NotificationItem[]) || [], error: null }
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult<{ id: string }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update notifications.' }
  }

  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', currentUser.id)

  if (error) {
    console.error('Error marking notification read:', error)
    return { data: null, error: error.message || 'Failed to update notification.' }
  }

  return { data: { id: notificationId }, error: null }
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ count: number }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update notifications.' }
  }

  const supabase = await createClient()
  const { error, data } = await (supabase as any)
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', currentUser.id)
    .eq('is_read', false)
    .select('id')

  if (error) {
    console.error('Error marking all notifications read:', error)
    return { data: null, error: error.message || 'Failed to update notifications.' }
  }

  return { data: { count: data?.length ?? 0 }, error: null }
}
