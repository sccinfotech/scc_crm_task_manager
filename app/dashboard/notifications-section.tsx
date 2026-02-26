'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/lib/notifications/actions'

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface NotificationsSectionProps {
  notifications: NotificationItem[]
}

export function NotificationsSection({ notifications: initialNotifications }: NotificationsSectionProps) {
  const router = useRouter()
  const unreadCount = initialNotifications.filter((n) => !n.is_read).length

  const handleMarkRead = async (id: string) => {
    const result = await markNotificationRead(id)
    if (!result.error) router.refresh()
  }

  const handleMarkAllRead = async () => {
    const result = await markAllNotificationsRead()
    if (!result.error) router.refresh()
  }

  if (initialNotifications.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1E1B4B]">Notifications</h2>
        <p className="mt-2 text-sm text-slate-500">No notifications yet.</p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1E1B4B]">Notifications</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {unreadCount} unread
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs font-semibold text-cyan-600 hover:text-cyan-700"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        {initialNotifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            onClick={() => handleMarkRead(notification.id)}
            className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
              notification.is_read ? 'bg-white' : 'bg-cyan-50/40'
            } hover:bg-cyan-50/60`}
          >
            <div className="flex items-start gap-2">
              <div
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  notification.is_read ? 'bg-transparent' : 'bg-cyan-500'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                {notification.body && (
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">{notification.body}</p>
                )}
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-400">
                    {formatRelativeTime(notification.created_at)}
                  </span>
                  {notification.project_id && (
                    <Link
                      href={`/dashboard/projects/${notification.project_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] font-medium text-cyan-600 hover:text-cyan-700 hover:underline"
                    >
                      View project →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
