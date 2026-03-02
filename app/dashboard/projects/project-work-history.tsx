'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import {
  getProjectWorkHistory,
  type ProjectWorkHistoryPayload,
  type ProjectWorkHistoryTeamDay,
  type ProjectTeamMember,
} from '@/lib/projects/actions'
import { EmptyState } from '@/app/components/empty-state'
import { StaffAvatar } from '@/app/components/ui/staff-avatar'

/** Work history is sourced from project_team_member_time_events (start/hold/resume/end + note on end). */
export const WORK_HISTORY_DATA_SOURCE = 'project_team_member_time_events'

/**
 * How the "Current session" timer works:
 * - Not started / Ended: shows 00:00:00 (past sessions appear in the list below).
 * - In progress (Start): shows this session's elapsed time:
 *   accumulated (segments closed by Hold) + current running segment.
 *   Uses client time until the server provides runningSince to avoid the initial 0s lag.
 * - On hold: shows accumulated time for the current session (up to the Hold event).
 */

interface ProjectWorkHistoryProps {
  projectId: string
  userRole: string
  currentUserId: string | undefined
  teamMembers: ProjectTeamMember[] | null | undefined
  /** When true, this tab is visible; used to silently refresh list when switching back */
  isActiveTab?: boolean
  className?: string
  hideHeader?: boolean
}

function formatHistoryDate(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00')
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  return `${fmt(start)} – ${fmt(end)}`
}

function formatTotalHours(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.round((totalSeconds % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)} : ${pad(m)} Hours`
}

function formatWorkSecondsHhMmSs(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function WorkHistoryLoadingSkeleton({ isTeamView }: { isTeamView: boolean }) {
  if (isTeamView) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading team work history">
        {[1, 2].map((dayKey) => (
          <div key={dayKey} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
              <span className="h-5 w-28 rounded bg-slate-200 animate-pulse" />
            </div>

            <div className="space-y-3">
              {[1, 2].map((memberKey) => (
                <section
                  key={`${dayKey}-${memberKey}`}
                  className="rounded-xl border border-slate-200/80 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                    <div className="space-y-1.5">
                      <span className="block h-4 w-32 rounded bg-slate-200 animate-pulse" />
                      <span className="block h-3 w-44 rounded bg-slate-100 animate-pulse" />
                    </div>
                    <span className="h-4 w-20 rounded bg-slate-200 animate-pulse" />
                  </div>

                  <ul className="list-none space-y-2 p-3">
                    {[1, 2].map((segmentKey) => (
                      <li
                        key={`${dayKey}-${memberKey}-${segmentKey}`}
                        className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="size-6 rounded-full bg-slate-200 animate-pulse" />
                            <span className="h-4 w-36 rounded bg-slate-200 animate-pulse" />
                          </div>
                          <span className="h-4 w-16 rounded bg-slate-200 animate-pulse" />
                        </div>
                        <div className="mt-2.5 ml-8 border-l-2 border-slate-100 pl-3">
                          <span className="block h-3 w-48 rounded bg-slate-100 animate-pulse" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading work history">
      {[1, 2].map((dayKey) => (
        <div key={dayKey} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="h-5 w-32 rounded bg-slate-200 animate-pulse" />
            <span className="h-5 w-24 rounded bg-slate-200 animate-pulse" />
          </div>
          <ul className="list-none space-y-3 pl-0">
            {[1, 2, 3].map((segKey) => (
              <li key={segKey} className="rounded-lg border border-slate-200/80 bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-full bg-slate-200 animate-pulse flex-shrink-0" />
                  <span className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
                </div>
                <div className="mt-2.5 ml-8 pl-3 border-l-2 border-slate-100">
                  <span className="block h-3 w-12 rounded bg-slate-100 animate-pulse mb-1.5" />
                  <div className="rounded-md bg-slate-50 px-3 py-2 space-y-1.5">
                    <span className="block h-3 w-full rounded bg-slate-200 animate-pulse" />
                    <span className="block h-3 w-3/4 rounded bg-slate-200 animate-pulse" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function ProjectWorkHistory({
  projectId,
  userRole,
  currentUserId,
  teamMembers,
  isActiveTab = true,
  className = '',
  hideHeader = false,
}: ProjectWorkHistoryProps) {
  const [historyData, setHistoryData] = useState<ProjectWorkHistoryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const wasActiveTabRef = useRef(false)

  const isStaff = userRole === 'staff'
  const isAdminOrManager = userRole === 'admin' || userRole === 'manager'
  const isTeamView = !isStaff && isAdminOrManager
  const singleDays = historyData?.mode === 'single' ? historyData.days : []
  const teamDays = historyData?.mode === 'team' ? historyData.days : []

  const loadWorkHistory = useCallback(
    (silent: boolean) => {
      const userId = isStaff ? currentUserId : (isAdminOrManager ? undefined : currentUserId)
      if (isStaff && !userId) {
        if (!silent) {
          setHistoryData({ mode: 'single', days: [] })
          setLoading(false)
          setError(null)
        }
        return
      }
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      getProjectWorkHistory(projectId, userId).then((result) => {
        if (result.error) {
          if (!silent) {
            setError(result.error)
            setHistoryData(null)
          }
        } else {
          setHistoryData(result.data ?? null)
        }
        if (!silent) setLoading(false)
      })
    },
    [projectId, isStaff, isAdminOrManager, currentUserId]
  )

  useEffect(() => {
    const hasRequiredUser = isStaff ? Boolean(currentUserId) : (isAdminOrManager ? true : Boolean(currentUserId))
    if (!hasRequiredUser) {
      setHistoryData({ mode: 'single', days: [] })
      setLoading(false)
      setError(null)
      return
    }
    loadWorkHistory(false)
  }, [projectId, isStaff, isAdminOrManager, currentUserId, loadWorkHistory])

  // When user switches back to Work history tab, silently refresh the list (skip on first mount; initial load already runs)
  useEffect(() => {
    if (isActiveTab) {
      if (!wasActiveTabRef.current) {
        wasActiveTabRef.current = true
        if (!loading) {
          const canRefresh = isStaff ? Boolean(currentUserId) : (isAdminOrManager ? true : Boolean(currentUserId))
          if (canRefresh) loadWorkHistory(true)
        }
      }
    } else {
      wasActiveTabRef.current = false
    }
  }, [isActiveTab, loading, isStaff, isAdminOrManager, currentUserId, loadWorkHistory])

  const totalProjectSeconds = (isTeamView ? teamDays : singleDays).reduce((acc, d) => acc + d.totalSeconds, 0)

  return (
    <div
      className={`h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}
    >
      {!hideHeader && (
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white/80 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#0891b2] flex items-center justify-center shadow-lg shadow-cyan-200/50">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold text-[#0C4A6E] tracking-tight">
              Work history
            </h4>
          </div>
          {isAdminOrManager && (
            loading ? (
              <span className="h-5 w-36 rounded bg-slate-200 animate-pulse" />
            ) : (
              <span className="text-sm font-bold text-[#0C4A6E] tabular-nums whitespace-nowrap">
                Team Total: {formatTotalHours(totalProjectSeconds)}
              </span>
            )
          )}
        </div>
      )}

      {hideHeader && isAdminOrManager && (
        <div className="flex-shrink-0 px-4 pt-3 pb-1 border-b border-slate-100 flex items-center justify-end">
          {loading ? (
            <span className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
          ) : (
            <span className="text-xs font-bold text-[#0C4A6E] tabular-nums whitespace-nowrap">
              Team Total: {formatTotalHours(totalProjectSeconds)}
            </span>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide">
          {loading ? (
            <WorkHistoryLoadingSkeleton isTeamView={isTeamView} />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          ) : (!isTeamView && !currentUserId) ? (
            <div className="text-sm text-slate-500">Sign in to see your work history.</div>
          ) : isTeamView && teamMembers && teamMembers.length === 0 ? (
            <div className="text-sm text-slate-500">No team members assigned to this project.</div>
          ) : isTeamView && teamDays.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center">
              <div className="w-full max-w-[280px]">
                <EmptyState
                  variant="followups"
                  title="No work history"
                  description="No logged work yet for this project team."
                />
              </div>
            </div>
          ) : !isTeamView && singleDays.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center">
              <div className="w-full max-w-[280px]">
                <EmptyState
                  variant="followups"
                  title="No work history"
                  description="When you start and end work sessions, they will appear here."
                />
              </div>
            </div>
          ) : isTeamView ? (
            <div className="space-y-6">
              {teamDays.map((day: ProjectWorkHistoryTeamDay) => (
                <div
                  key={day.date}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-base font-bold text-cyan-600">
                      {formatHistoryDate(day.date)}
                    </span>
                    <span className="font-digital text-base font-bold text-cyan-600 tabular-nums">
                      {formatTotalHours(day.totalSeconds)}
                    </span>
                  </div>

                  {day.members.length > 0 ? (
                    <div className="space-y-3">
                      {day.members.map((member) => (
                        <section
                          key={`${day.date}-${member.userId}`}
                          className="rounded-xl border border-slate-200/80 bg-white shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <StaffAvatar
                                photoUrl={member.userPhotoUrl}
                                fullName={member.userName}
                                email={member.userEmail}
                                size="md"
                                className="shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#0C4A6E]">
                                  {member.userName || member.userEmail || 'Staff'}
                                </p>
                                {member.userEmail && member.userEmail !== member.userName && (
                                  <p className="truncate text-xs text-slate-500">{member.userEmail}</p>
                                )}
                              </div>
                            </div>
                            <span className="font-digital text-sm font-bold text-[#0C4A6E] tabular-nums whitespace-nowrap">
                              {formatTotalHours(member.totalSeconds)}
                            </span>
                          </div>

                          {member.segments.length > 0 ? (
                            <ul className="list-none space-y-2 p-3">
                              {member.segments.map((seg, i) => {
                                const segmentSec = (new Date(seg.endAt).getTime() - new Date(seg.startAt).getTime()) / 1000
                                return (
                                  <li
                                    key={i}
                                    className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3"
                                  >
                                    <div className="flex items-center justify-between gap-2 text-slate-700">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className="inline-flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">
                                          {i + 1}
                                        </span>
                                        <span className="text-sm font-semibold tabular-nums text-[#0C4A6E]">
                                          {formatTimeRange(seg.startAt, seg.endAt)}
                                        </span>
                                      </div>
                                      <span className="font-digital flex-shrink-0 text-sm font-bold tabular-nums text-[#0C4A6E]">
                                        {formatWorkSecondsHhMmSs(segmentSec)}
                                      </span>
                                    </div>
                                    {seg.note && seg.note.trim() ? (
                                      <div className="mt-2.5 ml-8 border-l-2 border-cyan-200/80 pl-3">
                                        <div className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">
                                          <span className="whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word' }}>
                                            {seg.note.trim()}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="mt-1.5 ml-8 text-xs italic text-slate-400">No notes for this session.</p>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                          ) : (
                            <p className="px-3 py-3 text-sm text-slate-500 italic">No sessions recorded for this staff on this day.</p>
                          )}
                        </section>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No staff sessions recorded for this day.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {singleDays.map((day) => (
                <div
                  key={day.date}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="text-base font-bold text-cyan-600">
                      {formatHistoryDate(day.date)}
                    </span>
                    <span className="font-digital text-base font-bold text-cyan-600 tabular-nums">
                      {formatTotalHours(day.totalSeconds)}
                    </span>
                  </div>
                  {day.segments.length > 0 && (
                    <ul className="list-none space-y-3 pl-0">
                      {day.segments.map((seg, i) => {
                        const segmentSec = (new Date(seg.endAt).getTime() - new Date(seg.startAt).getTime()) / 1000
                        return (
                          <li
                            key={i}
                            className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                          >
                            <div className="flex items-center justify-between gap-2 text-slate-700">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="flex-shrink-0 size-6 rounded-full bg-cyan-100 text-cyan-700 inline-flex items-center justify-center text-xs font-bold">
                                  {i + 1}
                                </span>
                                <span className="text-sm font-semibold tabular-nums text-[#0C4A6E]">
                                  {formatTimeRange(seg.startAt, seg.endAt)}
                                </span>
                              </div>
                              <span className="font-digital flex-shrink-0 text-sm font-bold tabular-nums text-[#0C4A6E]">
                                {formatWorkSecondsHhMmSs(segmentSec)}
                              </span>
                            </div>
                            {seg.note && seg.note.trim() ? (
                              <div className="mt-2.5 ml-8 pl-3 border-l-2 border-cyan-200/80">
                                <div className="rounded-md bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
                                  <span className="whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word' }}>
                                    {seg.note.trim()}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1.5 ml-8 text-xs text-slate-400 italic">No notes for this session.</p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {day.segments.length === 0 && (
                    <p className="text-sm text-slate-500 italic">No sessions recorded for this day.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
