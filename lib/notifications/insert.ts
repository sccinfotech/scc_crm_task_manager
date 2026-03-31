import { createAdminClient } from '@/lib/supabase/admin'

export type NotificationInsertInput = {
  user_id: string
  project_id?: string | null
  task_id?: string | null
  type: string
  title: string
  body?: string | null
  meta?: Record<string, any> | null
  created_by: string
}

function mapNotificationRows(notifications: NotificationInsertInput[]) {
  return notifications.map((note) => ({
    user_id: note.user_id,
    project_id: note.project_id ?? null,
    task_id: note.task_id ?? null,
    type: note.type,
    title: note.title,
    body: note.body ?? null,
    meta: note.meta ?? null,
    created_by: note.created_by,
  }))
}

export async function insertNotificationsWithFallback(options: {
  notifications: NotificationInsertInput[]
  source: string
  fallbackClient?: any
}) {
  const { notifications, source, fallbackClient } = options
  if (notifications.length === 0) {
    return { error: null as string | null }
  }

  const rows = mapNotificationRows(notifications)

  if (fallbackClient) {
    const { error } = await (fallbackClient as any).from('notifications').insert(rows)
    if (!error) {
      return { error: null }
    }

    console.error(`[${source}] Failed to insert notifications with request client:`, error)
  }

  try {
    const adminClient = createAdminClient()
    const { error } = await (adminClient as any).from('notifications').insert(rows)
    if (!error) {
      return { error: null }
    }

    console.error(`[${source}] Failed to insert notifications with admin client:`, error)
    return { error: error.message || 'Failed to insert notifications.' }
  } catch (error) {
    console.warn(`[${source}] Admin notification insert unavailable after request-client failure.`, error)
    return { error: 'Failed to insert notifications.' }
  }
}
