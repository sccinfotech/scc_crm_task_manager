'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '@/app/components/empty-state'
import { StaffAvatar } from '@/app/components/ui/staff-avatar'
import {
  getProjectAnalytics,
  type ProjectAnalyticsPayload,
  type ProjectAnalyticsStaffTime,
} from '@/lib/projects/actions'

interface ProjectAnalyticsProps {
  projectId: string
  userRole: string
  className?: string
  hideHeader?: boolean
  isActiveTab?: boolean
}

function formatHoursMinutes(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

function formatLongDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }
  return `${seconds}s`
}

function formatRangeDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatStaffLabel(staff: ProjectAnalyticsStaffTime): string {
  return staff.userName || staff.userEmail || 'Staff Member'
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading analytics">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-9 w-32 animate-pulse rounded bg-slate-200" />
      </div>
      {[1, 2, 3].map((row) => (
        <div key={row} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-52 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-5 w-20 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export function ProjectAnalytics({
  projectId,
  userRole,
  className = '',
  hideHeader = false,
  isActiveTab = true,
}: ProjectAnalyticsProps) {
  const isAdminOrManager = userRole === 'admin' || userRole === 'manager'
  const [fromDateInput, setFromDateInput] = useState('')
  const [toDateInput, setToDateInput] = useState('')
  const [appliedFromDate, setAppliedFromDate] = useState('')
  const [appliedToDate, setAppliedToDate] = useState('')
  const [analytics, setAnalytics] = useState<ProjectAnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)
  const wasActiveTabRef = useRef(isActiveTab)
  const requestVersionRef = useRef(0)
  const appliedRangeRef = useRef<{ fromDate: string; toDate: string }>({ fromDate: '', toDate: '' })

  const loadAnalytics = useCallback(
    async (options?: { silent?: boolean; fromDate?: string; toDate?: string }) => {
      const silent = options?.silent ?? false
      if (!silent) {
        setLoading(true)
        setError(null)
      }

      const currentRequest = ++requestVersionRef.current
      const result = await getProjectAnalytics(projectId, {
        fromDate: options?.fromDate || null,
        toDate: options?.toDate || null,
      })

      if (currentRequest !== requestVersionRef.current) return

      if (result.error) {
        setError(result.error)
        if (!silent) {
          setAnalytics(null)
          setLoading(false)
        }
        return
      }

      setAnalytics(result.data)
      setError(null)
      if (!silent) {
        setLoading(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    hasLoadedRef.current = false
    requestVersionRef.current += 1
    setAnalytics(null)
    setError(null)
    setLoading(true)
  }, [projectId])

  useEffect(() => {
    const wasActive = wasActiveTabRef.current
    wasActiveTabRef.current = isActiveTab
    if (!isAdminOrManager || !isActiveTab) return

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      const { fromDate, toDate } = appliedRangeRef.current
      void loadAnalytics({ fromDate, toDate })
      return
    }

    if (!wasActive) {
      const { fromDate, toDate } = appliedRangeRef.current
      void loadAnalytics({ silent: true, fromDate, toDate })
    }
  }, [isActiveTab, isAdminOrManager, loadAnalytics])

  const handleApplyFilter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (fromDateInput && toDateInput && fromDateInput > toDateInput) {
      setError('From date must be earlier than or equal to To date.')
      return
    }

    setAppliedFromDate(fromDateInput)
    setAppliedToDate(toDateInput)
    appliedRangeRef.current = { fromDate: fromDateInput, toDate: toDateInput }
    await loadAnalytics({ fromDate: fromDateInput, toDate: toDateInput })
  }

  const handleResetFilter = async () => {
    setFromDateInput('')
    setToDateInput('')
    setAppliedFromDate('')
    setAppliedToDate('')
    appliedRangeRef.current = { fromDate: '', toDate: '' }
    await loadAnalytics({ fromDate: '', toDate: '' })
  }

  const activeRangeText = useMemo(() => {
    const from = analytics?.fromDate ?? appliedFromDate
    const to = analytics?.toDate ?? appliedToDate
    if (from && to) {
      return `${formatRangeDate(from)} to ${formatRangeDate(to)}`
    }
    if (from) {
      return `From ${formatRangeDate(from)}`
    }
    if (to) {
      return `Up to ${formatRangeDate(to)}`
    }
    return 'All logged time'
  }, [analytics?.fromDate, analytics?.toDate, appliedFromDate, appliedToDate])

  const staffTotals = analytics?.staffTotals ?? []
  const totalSeconds = analytics?.totalSeconds ?? 0

  if (!isAdminOrManager) {
    return (
      <div className={`h-full rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>
        <p className="text-sm text-slate-500">Project analytics is available only for Admin and Manager users.</p>
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {!hideHeader && (
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#16A34A] to-[#15803d] flex items-center justify-center shadow-lg shadow-emerald-200/60">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M7 14l4-4 3 3 5-7" />
              </svg>
            </div>
            <div>
              <h4 className="text-xl font-extrabold tracking-tight text-[#14532D]">Analytics</h4>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{activeRangeText}</p>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-slate-100 px-4 py-3">
        <form className="flex flex-col gap-3" onSubmit={handleApplyFilter}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</span>
              <input
                type="date"
                value={fromDateInput}
                onChange={(event) => setFromDateInput(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-[#06B6D4]"
                max={toDateInput || undefined}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</span>
              <input
                type="date"
                value={toDateInput}
                onChange={(event) => setToDateInput(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-[#06B6D4]"
                min={fromDateInput || undefined}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="mt-auto rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              Apply
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleResetFilter()}
              className="mt-auto rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide">
        {loading ? (
          <AnalyticsLoadingSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : !analytics ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Analytics data is not available right now.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-cyan-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Total Time Spent On This Project</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                <p className="font-digital text-3xl font-black tracking-tight text-[#14532D] tabular-nums">
                  {formatHoursMinutes(totalSeconds)}
                </p>
                <p className="font-digital text-sm font-semibold text-emerald-700 tabular-nums">
                  {formatLongDuration(totalSeconds)}
                </p>
              </div>
            </div>

            {staffTotals.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <div className="w-full max-w-[280px]">
                  <EmptyState
                    variant="followups"
                    title="No analytics data"
                    description="No work sessions were found for this filter range."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {staffTotals.map((staff) => {
                  const share = totalSeconds > 0 ? (staff.totalSeconds / totalSeconds) * 100 : 0
                  return (
                    <div key={staff.userId} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <StaffAvatar
                            photoUrl={staff.userPhotoUrl}
                            fullName={staff.userName}
                            email={staff.userEmail}
                            size="md"
                            className="shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#0F172A]">{formatStaffLabel(staff)}</p>
                            {staff.userEmail && staff.userEmail !== staff.userName && (
                              <p className="truncate text-xs text-slate-500">{staff.userEmail}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-digital text-lg font-extrabold text-cyan-700 tabular-nums">
                            {formatHoursMinutes(staff.totalSeconds)}
                          </p>
                          <p className="font-digital text-xs font-semibold text-slate-500 tabular-nums">
                            {formatLongDuration(staff.totalSeconds)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
                            style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
                          />
                        </div>
                        <p className="mt-1 text-right text-[11px] font-semibold text-slate-500 tabular-nums">
                          {share.toFixed(1)}% of project time
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
