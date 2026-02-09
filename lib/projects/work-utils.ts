/**
 * Pure helpers for team member work time. Not Server Actions (no 'use server').
 */

export type WorkTimeEvent = {
  user_id: string
  event_type: string
  occurred_at: string
  note?: string | null
}

/** One work segment (start→end) with optional note from the end event */
export type WorkHistorySegment = {
  startAt: string
  endAt: string
  note: string | null
}

/** Per-day work history for display: date, total seconds, and segments with notes */
export type WorkHistoryDay = {
  date: string
  totalSeconds: number
  segments: WorkHistorySegment[]
}

/**
 * Builds day-wise work history for a user from time events.
 * Each day has segments (start–end clipped to that day) and the note from the 'end' event (on the day the segment ends).
 */
export function computeWorkHistoryByDay(
  userId: string,
  events: WorkTimeEvent[],
  _asOf?: string
): WorkHistoryDay[] {
  const userEvents = events
    .filter((e) => e.user_id === userId)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
  // Build segments: start/resume → hold/end. End carries note; hold has no note.
  const fullSegments: { startAt: string; endAt: string; note: string | null }[] = []
  let segmentStart: number | null = null
  let segmentStartIso: string | null = null
  for (const ev of userEvents) {
    const t = new Date(ev.occurred_at).getTime()
    if (ev.event_type === 'start' || ev.event_type === 'resume') {
      if (segmentStart !== null && segmentStartIso) {
        // Close previous segment to avoid overlap if we receive a new start/resume.
        fullSegments.push({
          startAt: segmentStartIso,
          endAt: ev.occurred_at,
          note: null,
        })
      }
      segmentStart = t
      segmentStartIso = ev.occurred_at
    } else if ((ev.event_type === 'hold' || ev.event_type === 'end') && segmentStart !== null && segmentStartIso) {
      const note = ev.event_type === 'end' ? (ev.note ?? null) : null
      fullSegments.push({
        startAt: segmentStartIso,
        endAt: ev.occurred_at,
        note,
      })
      segmentStart = null
      segmentStartIso = null
    } else if (ev.event_type === 'end' && segmentStart === null) {
      // If the session was ended while on hold, attach the note to the last segment.
      const last = fullSegments[fullSegments.length - 1]
      if (last && last.note == null) last.note = ev.note ?? null
    }
  }

  // Split each segment by day and clip to day bounds; note attaches to the segment on its end day
  const daySegments: Record<string, WorkHistorySegment[]> = {}
  const daySeconds: Record<string, number> = {}
  for (const seg of fullSegments) {
    const segStart = new Date(seg.startAt).getTime()
    const segEnd = new Date(seg.endAt).getTime()
    const startDate = new Date(segStart)
    const endDate = new Date(segEnd)
    let dayCursor = new Date(startDate)
    dayCursor.setHours(0, 0, 0, 0)
    const endDay = new Date(endDate)
    endDay.setHours(0, 0, 0, 0)
    while (dayCursor.getTime() <= endDay.getTime()) {
      const key = dayCursor.toISOString().slice(0, 10)
      const dayStart = dayCursor.getTime()
      const dayEnd = dayStart + 24 * 60 * 60 * 1000
      const clipStart = Math.max(segStart, dayStart)
      const clipEnd = Math.min(segEnd, dayEnd)
      if (clipEnd > clipStart) {
        if (!daySegments[key]) daySegments[key] = []
        const isEndDay = segEnd >= dayStart && segEnd < dayEnd
        daySegments[key].push({
          startAt: new Date(clipStart).toISOString(),
          endAt: new Date(clipEnd).toISOString(),
          note: isEndDay ? seg.note : null,
        })
        daySeconds[key] = (daySeconds[key] || 0) + (clipEnd - clipStart) / 1000
      }
      dayCursor.setDate(dayCursor.getDate() + 1)
    }
  }

  return Object.entries(daySeconds)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, totalSeconds]) => ({
      date,
      totalSeconds,
      segments: daySegments[date] || [],
    }))
}

export function computeMemberWorkSeconds(
  userId: string,
  events: WorkTimeEvent[],
  _asOf?: string
): { totalSeconds: number; runningSince?: string; dayBreakdown: { date: string; seconds: number }[] } {
  // Computes the current session total (segments closed by hold/end since the last end).
  // runningSince is set when a segment is currently in progress.
  const userEvents = events
    .filter((e) => e.user_id === userId)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
  let sessionSeconds = 0
  let runningSince: string | undefined
  let sessionDaySeconds: Record<string, number> = {}
  let lastCompletedSeconds = 0
  let lastCompletedDaySeconds: Record<string, number> = {}
  let lastEventType: string | null = null

  const addSegmentToDays = (start: number, end: number, target: Record<string, number>) => {
    if (end <= start) return
    const startDate = new Date(start)
    const endDate = new Date(end)
    for (let d = startDate.getTime(); d <= endDate.getTime(); d += 24 * 60 * 60 * 1000) {
      const key = new Date(d).toISOString().slice(0, 10)
      const dayStart = new Date(d).setHours(0, 0, 0, 0)
      const dayEnd = dayStart + 24 * 60 * 60 * 1000
      const segStart = Math.max(start, dayStart)
      const segEnd = Math.min(end, dayEnd)
      if (segEnd > segStart) {
        target[key] = (target[key] || 0) + (segEnd - segStart) / 1000
      }
    }
  }

  let segmentStart: number | null = null
  for (const ev of userEvents) {
    lastEventType = ev.event_type
    const t = new Date(ev.occurred_at).getTime()
    if (ev.event_type === 'start' || ev.event_type === 'resume') {
      if (segmentStart !== null) {
        const seg = Math.max(0, (t - segmentStart) / 1000)
        sessionSeconds += seg
        addSegmentToDays(segmentStart, t, sessionDaySeconds)
      }
      segmentStart = t
    } else if (ev.event_type === 'hold' || ev.event_type === 'end') {
      if (segmentStart !== null) {
        const seg = Math.max(0, (t - segmentStart) / 1000)
        sessionSeconds += seg
        addSegmentToDays(segmentStart, t, sessionDaySeconds)
        segmentStart = null
      }
      if (ev.event_type === 'end') {
        lastCompletedSeconds = sessionSeconds
        lastCompletedDaySeconds = sessionDaySeconds
        sessionSeconds = 0
        sessionDaySeconds = {}
      }
    }
  }

  let totalSeconds = sessionSeconds
  let daySeconds = sessionDaySeconds
  if (segmentStart !== null) {
    runningSince = new Date(segmentStart).toISOString()
  } else if (lastEventType === 'end') {
    totalSeconds = lastCompletedSeconds
    daySeconds = lastCompletedDaySeconds
  }

  const dayBreakdown = Object.entries(daySeconds)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, seconds]) => ({ date, seconds }))

  return { totalSeconds, runningSince, dayBreakdown }
}
