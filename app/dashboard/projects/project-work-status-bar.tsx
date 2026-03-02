'use client'

import { useEffect, useRef, useState } from 'react'

export type WorkStatusState = {
  status: 'not_started' | 'start' | 'hold' | 'end'
  runningSince: string | null
  totalSeconds: number
  isUpdating: boolean
}

interface ProjectWorkStatusBarProps {
  workState: WorkStatusState
  onWorkStatus: (eventType: 'start' | 'hold' | 'resume' | 'end', note?: string) => Promise<void>
  onOpenEndModal: () => void
  className?: string
}

function formatWorkSecondsHhMmSs(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function formatWorkStatus(status: WorkStatusState['status']): string {
  if (status === 'not_started') return 'Not started'
  if (status === 'start') return 'In progress'
  if (status === 'hold') return 'On hold'
  return 'Ended'
}

const WORK_TIMER_TICK_MS = 2000

export function ProjectWorkStatusBar({
  workState,
  onWorkStatus,
  onOpenEndModal,
  className = '',
}: ProjectWorkStatusBarProps) {
  const [liveTick, setLiveTick] = useState(() => Date.now())
  const sessionStartClientMs = useRef<number | null>(null)

  const { status, runningSince, totalSeconds, isUpdating } = workState
  const isRunning = status === 'start'

  useEffect(() => {
    if (status !== 'start') return
    const id = setInterval(() => setLiveTick(Date.now()), WORK_TIMER_TICK_MS)
    return () => clearInterval(id)
  }, [status])

  const parsedRunningSince = runningSince ? new Date(runningSince).getTime() : NaN
  const runningSinceMs = Number.isFinite(parsedRunningSince) ? parsedRunningSince : null

  if (status === 'start') {
    if (sessionStartClientMs.current === null) {
      sessionStartClientMs.current = runningSinceMs ?? Date.now()
    } else if (runningSinceMs !== null && runningSinceMs < sessionStartClientMs.current) {
      sessionStartClientMs.current = runningSinceMs
    }
  } else {
    sessionStartClientMs.current = null
  }

  const currentMs = isRunning ? liveTick : Date.now()
  const elapsedSec =
    status !== 'start'
      ? totalSeconds
      : (() => {
          const anchorMs = sessionStartClientMs.current
          const runningDelta = anchorMs !== null ? Math.max(0, currentMs - anchorMs) / 1000 : 0
          return totalSeconds + runningDelta
        })()

  const statusStyles: Record<string, string> = {
    not_started: 'bg-slate-100 text-slate-600 border-slate-200',
    start: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    hold: 'bg-amber-100 text-amber-800 border-amber-200',
    end: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  }
  const style = statusStyles[status] || statusStyles.not_started

  const showOnlyStartButton = status === 'not_started' || status === 'end'

  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 ${className}`}
      role="group"
      aria-label="Work status"
    >
      <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1 sm:px-2.5 sm:py-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timer</span>
        <span className="font-digital text-sm font-bold tabular-nums text-slate-800 sm:text-base">
          {formatWorkSecondsHhMmSs(elapsedSec)}
        </span>
      </div>
      <span className={`hidden rounded-full border px-1.5 py-0.5 text-[10px] font-bold sm:inline-flex ${style}`}>
        {formatWorkStatus(status)}
      </span>
      {showOnlyStartButton ? (
        <button
          type="button"
          onClick={() => onWorkStatus('start')}
          disabled={isUpdating}
          className="rounded-md bg-cyan-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed sm:px-3 sm:py-1.5"
        >
          {status === 'end' ? 'Start again' : 'Start work'}
        </button>
      ) : (
        <div className="flex items-center gap-1">
          {status === 'start' && (
            <>
              <button
                type="button"
                onClick={() => onWorkStatus('hold')}
                disabled={isUpdating}
                className="rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50 sm:px-2.5 sm:py-1.5"
              >
                Hold
              </button>
              <button
                type="button"
                onClick={onOpenEndModal}
                disabled={isUpdating}
                className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 sm:px-2.5 sm:py-1.5"
              >
                End
              </button>
            </>
          )}
          {status === 'hold' && (
            <>
              <button
                type="button"
                onClick={() => onWorkStatus('resume')}
                disabled={isUpdating}
                className="rounded-md bg-cyan-600 px-2 py-1 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-50 sm:px-2.5 sm:py-1.5"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={onOpenEndModal}
                disabled={isUpdating}
                className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 sm:px-2.5 sm:py-1.5"
              >
                End
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
