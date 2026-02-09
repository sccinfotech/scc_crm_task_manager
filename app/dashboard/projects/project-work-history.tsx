'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { getProjectWorkHistory } from '@/lib/projects/actions'
import type { WorkHistoryDay } from '@/lib/projects/work-utils'
import type { ProjectTeamMember } from '@/lib/projects/actions'
import { EmptyState } from '@/app/components/empty-state'

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

export type StaffWorkState = {
  status: 'not_started' | 'start' | 'hold' | 'end'
  runningSince: string | null
  totalSeconds: number
  isUpdating: boolean
}

interface ProjectWorkHistoryProps {
  projectId: string
  userRole: string
  currentUserId: string | undefined
  teamMembers: ProjectTeamMember[] | null | undefined
  /** When staff: show Start/Hold/End at bottom and inline end-notes (no modal) */
  staffWorkState?: StaffWorkState | null
  onStaffWorkStatus?: (eventType: 'start' | 'hold' | 'resume' | 'end', note?: string) => Promise<void>
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

function formatWorkSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h < 24) return rem > 0 ? `${h}h ${rem}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`
}

function formatWorkSecondsHhMmSs(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function formatWorkStatus(status: StaffWorkState['status']): string {
  if (status === 'not_started') return 'Not started'
  if (status === 'start') return 'In progress'
  if (status === 'hold') return 'On hold'
  return 'Ended'
}

export function ProjectWorkHistory({
  projectId,
  userRole,
  currentUserId,
  teamMembers,
  staffWorkState = null,
  onStaffWorkStatus,
  isActiveTab = true,
  className = '',
  hideHeader = false,
}: ProjectWorkHistoryProps) {
  const [days, setDays] = useState<WorkHistoryDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [endNotesOpen, setEndNotesOpen] = useState(false)
  const [endNotes, setEndNotes] = useState('')
  const [liveTick, setLiveTick] = useState(() => Date.now())
  // Local anchor for the current running segment to avoid negative time from server/client clock skew.
  const sessionStartClientMs = useRef<number | null>(null)
  const wasActiveTabRef = useRef(false)

  const isStaff = userRole === 'staff'
  const showStaffActions = isStaff && Boolean(staffWorkState && onStaffWorkStatus)

  // Staff only: tick every second so the timer updates live when work is in progress
  useEffect(() => {
    if (!showStaffActions || !staffWorkState || staffWorkState.status !== 'start') return
    const id = setInterval(() => setLiveTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [showStaffActions, staffWorkState?.status])

  // Only show Done points form when user has clicked "End session". Close it when status is no longer start/hold.
  useEffect(() => {
    if (!showStaffActions || !staffWorkState) return
    const { status } = staffWorkState
    if (status === 'end' || status === 'not_started') {
      setEndNotesOpen(false)
      setEndNotes('')
    }
  }, [showStaffActions, staffWorkState?.status])

  const showStaffSelector = !isStaff && teamMembers && teamMembers.length > 0

  const loadWorkHistory = useCallback(
    (silent: boolean) => {
      const userId = isStaff ? currentUserId : selectedUserId ?? currentUserId ?? null
      if (!userId) {
        if (!silent) {
          setDays([])
          setLoading(false)
          if (!isStaff && !selectedUserId) setError(null)
        }
        return
      }
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      getProjectWorkHistory(projectId, isStaff ? undefined : userId).then((result) => {
        if (result.error) {
          if (!silent) {
            setError(result.error)
            setDays([])
          }
        } else {
          setDays(result.data ?? [])
        }
        if (!silent) setLoading(false)
      })
    },
    [projectId, isStaff, currentUserId, selectedUserId]
  )

  useEffect(() => {
    const userId = isStaff ? currentUserId : selectedUserId ?? currentUserId ?? null
    if (!userId) {
      setDays([])
      setLoading(false)
      if (!isStaff && !selectedUserId) setError(null)
      return
    }
    loadWorkHistory(false)
  }, [projectId, isStaff, currentUserId, selectedUserId, loadWorkHistory])

  // When user switches back to Work history tab, silently refresh the list (skip on first mount; initial load already runs)
  useEffect(() => {
    if (isActiveTab) {
      if (!wasActiveTabRef.current) {
        wasActiveTabRef.current = true
        if (!loading) {
          const userId = isStaff ? currentUserId : selectedUserId ?? currentUserId ?? null
          if (userId) loadWorkHistory(true)
        }
      }
    } else {
      wasActiveTabRef.current = false
    }
  }, [isActiveTab, loading, isStaff, currentUserId, selectedUserId, loadWorkHistory])

  useEffect(() => {
    if (!showStaffSelector || selectedUserId !== null) return
    const first = teamMembers?.[0]
    if (first) setSelectedUserId(first.id)
  }, [showStaffSelector, teamMembers, selectedUserId])

  const selectedMember = showStaffSelector && selectedUserId
    ? teamMembers?.find((m) => m.id === selectedUserId)
    : null

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
          {showStaffSelector && (
            <select
              value={selectedUserId ?? ''}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              aria-label="Select staff member"
            >
              {teamMembers?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email || 'Staff'}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {hideHeader && showStaffSelector && (
        <div className="flex-shrink-0 px-4 pt-3 pb-1 border-b border-slate-100">
          <label className="sr-only" htmlFor="work-history-staff-select">View work history for</label>
          <select
            id="work-history-staff-select"
            value={selectedUserId ?? ''}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
            aria-label="Select staff member"
          >
            {teamMembers?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || m.email || 'Staff'}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide">
          {loading ? (
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
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : !showStaffSelector && !currentUserId ? (
          <div className="text-sm text-slate-500">Sign in to see your work history.</div>
        ) : !isStaff && teamMembers && teamMembers.length === 0 ? (
          <div className="text-sm text-slate-500">No team members assigned to this project.</div>
        ) : showStaffSelector && !selectedUserId ? (
          <div className="text-sm text-slate-500">Select a staff member to view work history.</div>
        ) : days.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <div className="w-full max-w-[280px]">
              <EmptyState
                variant="followups"
                title="No work history"
                description={
                  selectedMember
                    ? `No logged work yet for ${selectedMember.full_name || selectedMember.email || 'this staff'}.`
                    : 'When you start and end work sessions, they will appear here.'
                }
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {days.map((day) => (
              <div
                key={day.date}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-base font-bold text-[#0C4A6E]">
                    {formatHistoryDate(day.date)}
                  </span>
                  <span className="text-base font-bold text-[#0C4A6E] tabular-nums">
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
                          <span className="flex-shrink-0 text-sm font-bold tabular-nums text-[#0C4A6E]">
                            {formatWorkSecondsHhMmSs(segmentSec)}
                          </span>
                        </div>
                        {seg.note && seg.note.trim() ? (
                          <div className="mt-2.5 ml-8 pl-3 border-l-2 border-cyan-200/80">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                              Notes
                            </p>
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
                    )})}
                  </ul>
                )}
                {day.segments.length === 0 && (
                  <p className="text-sm text-slate-500 italic">No segments recorded for this day.</p>
                )}
              </div>
            ))}
          </div>
        )}
        </div>

        {showStaffActions && staffWorkState && onStaffWorkStatus && (
          <div className="flex-shrink-0 border-t border-slate-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
            {(() => {
              const status = staffWorkState.status
              const totalSec = staffWorkState.totalSeconds
              const runningSince = staffWorkState.runningSince
              const isRunning = status === 'start'
              const currentMs = isRunning ? liveTick : Date.now()
              const parsedRunningSince = runningSince ? new Date(runningSince).getTime() : NaN
              const runningSinceMs = Number.isFinite(parsedRunningSince) ? parsedRunningSince : null
              // "Current session" shows only THIS session's time (accumulated segments + current running segment).
              // Keep a local anchor so the timer never goes negative or resets on server response.
              if (status === 'start') {
                if (sessionStartClientMs.current === null) {
                  sessionStartClientMs.current = runningSinceMs ?? Date.now()
                } else if (runningSinceMs !== null && runningSinceMs < sessionStartClientMs.current) {
                  sessionStartClientMs.current = runningSinceMs
                }
              } else {
                sessionStartClientMs.current = null
              }
              const elapsedSec = (() => {
                if (status !== 'start') return totalSec
                const anchorMs = sessionStartClientMs.current
                const runningDelta = anchorMs !== null ? Math.max(0, currentMs - anchorMs) / 1000 : 0
                return totalSec + runningDelta
              })()
              const statusStyles: Record<string, string> = {
                not_started: 'bg-slate-100 text-slate-600 border-slate-200',
                start: 'bg-cyan-100 text-cyan-800 border-cyan-200',
                hold: 'bg-amber-100 text-amber-800 border-amber-200',
                end: 'bg-emerald-100 text-emerald-800 border-emerald-200',
              }
              const style = statusStyles[status] || statusStyles.not_started
              const showEndForm = endNotesOpen && (status === 'start' || status === 'hold')
              const showOnlyStartButton = status === 'not_started' || status === 'end'

              if (showOnlyStartButton) {
                return (
                  <div className="px-3 py-2.5">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => onStaffWorkStatus('start')}
                        disabled={staffWorkState.isUpdating}
                        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50 cursor-pointer transition-colors"
                      >
                        {status === 'end' ? 'Start again' : 'Start work'}
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div className="px-3 py-2.5">
                  {/* Single compact block: when End form is open, status + Hold sit on the same panel as Done points */}
                  <div className="flex flex-wrap items-center gap-2 gap-y-2 mb-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current session</span>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-sm font-bold ${style}`}>
                      {formatWorkStatus(status)}
                    </span>
                    <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-base font-bold text-slate-800 tabular-nums">
                      {formatWorkSecondsHhMmSs(elapsedSec) + (isRunning ? ' (live)' : '')}
                    </span>
                    {status === 'start' && !showEndForm && (
                      <>
                        <button
                          type="button"
                          onClick={() => onStaffWorkStatus('hold')}
                          disabled={staffWorkState.isUpdating}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer transition-colors ml-auto"
                        >
                          Hold
                        </button>
                        <button
                          type="button"
                          onClick={() => setEndNotesOpen(true)}
                          disabled={staffWorkState.isUpdating}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          End session
                        </button>
                      </>
                    )}
                    {status === 'hold' && !showEndForm && (
                      <>
                        <button
                          type="button"
                          onClick={() => onStaffWorkStatus('resume')}
                          disabled={staffWorkState.isUpdating}
                          className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50 cursor-pointer transition-colors ml-auto"
                        >
                          Resume
                        </button>
                        <button
                          type="button"
                          onClick={() => setEndNotesOpen(true)}
                          disabled={staffWorkState.isUpdating}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          End session
                        </button>
                      </>
                    )}
                    {/* When form is open: Hold/Resume on same row so user can cancel ending */}
                    {showEndForm && status === 'start' && (
                      <button
                        type="button"
                        onClick={() => onStaffWorkStatus('hold')}
                        disabled={staffWorkState.isUpdating}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer transition-colors ml-auto"
                      >
                        Hold
                      </button>
                    )}
                    {showEndForm && status === 'hold' && (
                      <button
                        type="button"
                        onClick={() => onStaffWorkStatus('resume')}
                        disabled={staffWorkState.isUpdating}
                        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50 cursor-pointer transition-colors ml-auto"
                      >
                        Resume
                      </button>
                    )}
                  </div>
                  {showEndForm && (
                    <div className="mt-2 pt-2 border-t border-slate-200/80">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        Done points <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-2 items-stretch">
                        <textarea
                          value={endNotes}
                          onChange={(e) => setEndNotes(e.target.value)}
                          placeholder="What did you complete in this session?"
                          className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[52px] max-h-24 resize-y focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-cyan-500/20 placeholder:text-slate-400"
                          rows={2}
                        />
                        <div className="flex flex-col gap-2 flex-shrink-0 justify-center">
                          <button
                            type="button"
                            onClick={() => { setEndNotesOpen(false); setEndNotes('') }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors whitespace-nowrap"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!endNotes.trim()) return
                              await onStaffWorkStatus('end', endNotes.trim())
                              setEndNotesOpen(false)
                              setEndNotes('')
                              loadWorkHistory(true)
                            }}
                            disabled={staffWorkState.isUpdating || !endNotes.trim()}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors whitespace-nowrap"
                          >
                            {staffWorkState.isUpdating ? 'Saving…' : 'Save & end'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
