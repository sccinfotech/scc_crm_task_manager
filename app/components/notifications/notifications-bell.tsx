'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { hasSupabaseClientConfig } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/ui/toast-context'
import {
  getNotifications,
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

export function NotificationsBell({ userId }: { userId?: string }) {
  const { info } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const panelRef = useRef<HTMLDivElement | null>(null)

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  )

  const loadNotifications = async () => {
    setLoading(true)
    const result = await getNotifications(40)
    if (!result.error && result.data) {
      setNotifications(result.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!userId) return
    loadNotifications()
  }, [userId])

  useEffect(() => {
    if (!userId || !hasSupabaseClientConfig()) return
    try {
      const supabase = createClient()
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const next = payload.new as NotificationItem
            setNotifications((prev) => [next, ...prev])
            info(next.title, next.body || 'You have a new notification')
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch {
      // Supabase client not available (e.g. env vars missing); skip realtime
    }
  }, [userId, info])

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      if (!panelRef.current) return
      if (!panelRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleMarkAllRead = async () => {
    const result = await markAllNotificationsRead()
    if (!result.error) {
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })))
    }
  }

  const handleMarkRead = async (id: string) => {
    const result = await markNotificationRead(id)
    if (!result.error) {
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)))
    }
  }

  if (!userId) return null

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-[#06B6D4] transition-colors"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0h6z"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[320px] max-w-[90vw] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#1E1B4B]">Notifications</p>
              <p className="text-xs text-gray-500">{unreadCount} unread</p>
            </div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-[#06B6D4] hover:text-[#0891b2]"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-gray-500">Loading notifications…</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No notifications yet.</div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleMarkRead(notification.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                    notification.is_read ? 'bg-white' : 'bg-cyan-50/40'
                  } hover:bg-cyan-50/60`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-1 h-2 w-2 rounded-full ${
                        notification.is_read ? 'bg-transparent' : 'bg-[#06B6D4]'
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                      {notification.body && (
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2">{notification.body}</p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatRelativeTime(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
