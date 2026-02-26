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
          <p className="text-xs text-slate-500 mt-0.5">{unreadCount} unread</p>
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="w-6 py-3 pl-4 pr-2 text-left" aria-label="Status" />
              <th className="text-left py-3 px-3 font-medium text-slate-700 min-w-[140px]">Title</th>
              <th className="text-left py-3 px-3 font-medium text-slate-700">Content</th>
              <th className="text-left py-3 px-3 font-medium text-slate-700 w-[100px] whitespace-nowrap">Time</th>
              <th className="text-right py-3 pl-3 pr-4 font-medium text-slate-700 w-[100px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {initialNotifications.map((notification) => (
              <tr
                key={notification.id}
                onClick={() => handleMarkRead(notification.id)}
                className={`border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50/80 ${
                  notification.is_read ? 'bg-white' : 'bg-cyan-50/40'
                }`}
              >
                <td className="py-3 pl-4 pr-2 align-top">
                  <div
                    className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      notification.is_read ? 'bg-transparent' : 'bg-cyan-500'
                    }`}
                  />
                </td>
                <td className="py-3 px-3 align-top">
                  <span className="font-semibold text-slate-800">{notification.title}</span>
                </td>
                <td className="py-3 px-3 align-top">
                  <span className="text-slate-600 line-clamp-2">{notification.body || '—'}</span>
                </td>
                <td className="py-3 px-3 align-top whitespace-nowrap text-slate-500">
                  {formatRelativeTime(notification.created_at)}
                </td>
                <td className="py-3 pl-3 pr-4 align-top text-right">
                  {notification.project_id ? (
                    <Link
                      href={`/dashboard/projects/${notification.project_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center text-xs font-medium text-cyan-600 hover:text-cyan-700 hover:underline"
                    >
                      View project →
                    </Link>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
