'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hasSupabaseClientConfig } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/client'
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
  userId: string
  notifications: NotificationItem[]
}

function getProjectTitle(notification: NotificationItem) {
  const projectName = notification.meta?.project_name
  if (typeof projectName === 'string' && projectName.trim().length > 0) {
    return projectName.trim()
  }

  return notification.project_title
}

function enrichNotification(notification: NotificationItem): NotificationItem {
  return {
    ...notification,
    project_title: notification.project_title ?? getProjectTitle(notification) ?? null,
  }
}

function prependNotification(list: NotificationItem[], notification: NotificationItem) {
  const next = enrichNotification(notification)
  return [next, ...list.filter((item) => item.id !== next.id)]
}

export function NotificationsSection({ userId, notifications: initialNotifications }: NotificationsSectionProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    initialNotifications.map((notification) => enrichNotification(notification))
  )

  useEffect(() => {
    setNotifications(initialNotifications.map((notification) => enrichNotification(notification)))
  }, [initialNotifications])

  useEffect(() => {
    if (!userId || !hasSupabaseClientConfig()) return

    try {
      const supabase = createClient()
      const channel = supabase
        .channel(`dashboard-notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            setNotifications((prev) => prependNotification(prev, payload.new as NotificationItem))
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const next = enrichNotification(payload.new as NotificationItem)
            setNotifications((prev) =>
              prev.map((item) =>
                item.id === next.id
                  ? {
                      ...item,
                      ...next,
                      project_title: next.project_title ?? item.project_title ?? null,
                    }
                  : item
              )
            )
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch {
      // Supabase client not available (e.g. env vars missing); skip realtime
    }
  }, [userId])

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  )

  const handleRowClick = async (notification: NotificationItem) => {
    const result = await markNotificationRead(notification.id)
    if (result.error) return
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id
          ? { ...item, is_read: true, read_at: item.read_at ?? new Date().toISOString() }
          : item
      )
    )

    if (notification.project_id) {
      router.push(`/dashboard/projects/${notification.project_id}`)
      return
    }
  }

  const handleMarkAllRead = async () => {
    const result = await markAllNotificationsRead()
    if (!result.error) {
      const readAt = new Date().toISOString()
      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at ?? readAt,
        }))
      )
    }
  }

  if (notifications.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1E1B4B]">Notifications</h2>
        <p className="mt-2 text-sm text-slate-500">No notifications yet.</p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden h-full flex flex-col min-h-0">
      <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-3 sm:px-4 flex items-center justify-between flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#1E1B4B] sm:text-lg">Notifications</h2>
          <p className="text-xs text-slate-500 mt-0.5">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 whitespace-nowrap flex-shrink-0 ml-2"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto -mx-px sm:mx-0">
        <ul className="list-none space-y-2 p-3 md:hidden" aria-label="Notifications list">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                onClick={() => handleRowClick(notification)}
                className={`flex w-full rounded-xl border border-slate-200 p-3 text-left shadow-sm transition-colors hover:bg-slate-50/80 ${
                  notification.is_read ? 'bg-white' : 'bg-cyan-50/50 border-cyan-100'
                }`}
              >
                <div
                  className={`mr-3 mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    notification.is_read ? 'bg-transparent' : 'bg-cyan-500'
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">{notification.title}</p>
                  {notification.project_id && notification.project_title && (
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                      Project: {notification.project_title}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-slate-600 line-clamp-3">{notification.body || '—'}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(notification.created_at)}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="w-6 py-3 pl-3 pr-2 sm:pl-4 text-left" aria-label="Status" />
                <th className="text-left py-3 px-3 sm:px-4 font-medium text-slate-700 min-w-[160px] sm:min-w-[180px]">
                  Title
                </th>
                <th className="text-left py-3 px-3 sm:px-4 font-medium text-slate-700">Content</th>
                <th className="text-left py-3 px-3 sm:px-4 font-medium text-slate-700 w-[90px] sm:w-[100px] whitespace-nowrap">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification) => (
                <tr
                  key={notification.id}
                  onClick={() => handleRowClick(notification)}
                  className={`border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50/80 ${
                    notification.is_read ? 'bg-white' : 'bg-cyan-50/40'
                  }`}
                >
                  <td className="py-3 pl-3 pr-2 sm:pl-4 align-top">
                    <div
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                        notification.is_read ? 'bg-transparent' : 'bg-cyan-500'
                      }`}
                    />
                  </td>
                  <td className="py-3 px-3 align-top">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">{notification.title}</span>
                      {notification.project_id && notification.project_title && (
                        <span className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                          Project: {notification.project_title}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 align-top">
                    <span className="text-slate-600 line-clamp-2">{notification.body || '—'}</span>
                  </td>
                  <td className="py-3 px-3 align-top whitespace-nowrap text-slate-500">
                    {formatRelativeTime(notification.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
