export type AutoEndedWorkSession = {
  projectId: string
  projectName: string | null
  userId: string
  cutoffIso: string
}

type TimeZoneDateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

type CutoffConfig = {
  timezone: string
  hour: number
  minute: number
}

export type AutoEndWorkSessionsResult = {
  endedSessions: AutoEndedWorkSession[]
  cutoffIso: string | null
  cutoffLabel: string
  timezone: string
}

const DEFAULT_CUTOFF_TIME = '19:30'
const DEFAULT_COMPANY_TIMEZONE = 'Asia/Kolkata'

function parseCutoffTime(rawValue: string): { hour: number; minute: number } {
  const normalized = rawValue.trim()
  const match = normalized.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (!match) {
    return { hour: 19, minute: 30 }
  }
  return {
    hour: Number.parseInt(match[1], 10),
    minute: Number.parseInt(match[2], 10),
  }
}

function resolveCompanyTimezone(rawTimezone: string | undefined): string {
  const candidate = rawTimezone?.trim() || DEFAULT_COMPANY_TIMEZONE
  try {
    // Validate timezone string early; fallback keeps runtime stable.
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return DEFAULT_COMPANY_TIMEZONE
  }
}

function getCutoffConfig(): CutoffConfig {
  const timezone = resolveCompanyTimezone(process.env.COMPANY_TIMEZONE)
  const parsed = parseCutoffTime(process.env.WORK_SESSION_AUTO_END_TIME || DEFAULT_CUTOFF_TIME)
  return {
    timezone,
    hour: parsed.hour,
    minute: parsed.minute,
  }
}

function getTimeZoneDateParts(date: Date, timeZone: string): TimeZoneDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const map = new Map(parts.map((part) => [part.type, part.value]))

  return {
    year: Number.parseInt(map.get('year') || '0', 10),
    month: Number.parseInt(map.get('month') || '0', 10),
    day: Number.parseInt(map.get('day') || '0', 10),
    hour: Number.parseInt(map.get('hour') || '0', 10),
    minute: Number.parseInt(map.get('minute') || '0', 10),
    second: Number.parseInt(map.get('second') || '0', 10),
  }
}

function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const zoned = getTimeZoneDateParts(instant, timeZone)
  const asUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  )
  return asUtc - instant.getTime()
}

function zonedDateTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone)
  let resolved = utcGuess - firstOffset
  const secondOffset = getTimeZoneOffsetMs(new Date(resolved), timeZone)
  if (secondOffset !== firstOffset) {
    resolved = utcGuess - secondOffset
  }
  return resolved
}

function computeTodayCutoffIso(now: Date, config: CutoffConfig): string | null {
  const localNow = getTimeZoneDateParts(now, config.timezone)
  const cutoffMs = zonedDateTimeToUtcMs(
    localNow.year,
    localNow.month,
    localNow.day,
    config.hour,
    config.minute,
    config.timezone
  )
  if (now.getTime() < cutoffMs) {
    return null
  }
  return new Date(cutoffMs).toISOString()
}

export function getWorkSessionCutoffDisplay(): { cutoffLabel: string; timezone: string } {
  const config = getCutoffConfig()
  const label = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, 0, 1, config.hour, config.minute)))

  return {
    cutoffLabel: label,
    timezone: config.timezone,
  }
}

export async function autoEndWorkSessionsAtCutoff(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  options?: { userId?: string; now?: Date }
): Promise<AutoEndWorkSessionsResult> {
  const config = getCutoffConfig()
  const now = options?.now ?? new Date()
  const cutoffIso = computeTodayCutoffIso(now, config)
  const { cutoffLabel, timezone } = getWorkSessionCutoffDisplay()

  if (!cutoffIso) {
    return { endedSessions: [], cutoffIso: null, cutoffLabel, timezone }
  }

  let membersQuery = supabase
    .from('project_team_members')
    .select('project_id, user_id, work_status, work_started_at')
    .in('work_status', ['start', 'hold'])

  if (options?.userId) {
    membersQuery = membersQuery.eq('user_id', options.userId)
  }

  const { data: memberRows, error: memberError } = await membersQuery
  if (memberError) {
    console.error('Auto-end cutoff: failed to fetch running sessions:', memberError)
    return { endedSessions: [], cutoffIso, cutoffLabel, timezone }
  }

  const rows = (memberRows ?? []) as Array<{
    project_id: string
    user_id: string
    work_status: string
    work_started_at: string | null
  }>

  const eligible = rows.filter((row) => {
    if (!row.work_started_at) return false
    return row.work_started_at < cutoffIso
  })

  if (eligible.length === 0) {
    return { endedSessions: [], cutoffIso, cutoffLabel, timezone }
  }

  const projectIds = [...new Set(eligible.map((row) => row.project_id))]
  const { data: projectRows } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', projectIds)

  const projectNameById = new Map<string, string | null>()
  ;(projectRows as Array<{ id: string; name: string | null }> | null)?.forEach((project) => {
    projectNameById.set(project.id, project.name ?? null)
  })

  const autoEndNote = `Auto-ended at ${cutoffLabel} (${timezone}) by company cutoff policy.`
  const timeEventsToInsert = eligible.map((row) => ({
    project_id: row.project_id,
    user_id: row.user_id,
    event_type: 'end',
    occurred_at: cutoffIso,
    note: autoEndNote,
  }))

  const { error: eventInsertError } = await supabase
    .from('project_team_member_time_events')
    .insert(timeEventsToInsert as never)

  if (eventInsertError) {
    console.error('Auto-end cutoff: failed to insert end events:', eventInsertError)
    return { endedSessions: [], cutoffIso, cutoffLabel, timezone }
  }

  let updateQuery = supabase
    .from('project_team_members')
    .update({
      work_status: 'end',
      work_ended_at: cutoffIso,
      work_done_notes: autoEndNote,
    } as never)
    .in('project_id', projectIds)
    .in('work_status', ['start', 'hold'])
    .lt('work_started_at', cutoffIso)

  if (options?.userId) {
    updateQuery = updateQuery.eq('user_id', options.userId)
  }

  const { error: updateError } = await updateQuery
  if (updateError) {
    console.error('Auto-end cutoff: failed to update session rows:', updateError)
    return { endedSessions: [], cutoffIso, cutoffLabel, timezone }
  }

  return {
    endedSessions: eligible.map((row) => ({
      projectId: row.project_id,
      projectName: projectNameById.get(row.project_id) ?? null,
      userId: row.user_id,
      cutoffIso,
    })),
    cutoffIso,
    cutoffLabel,
    timezone,
  }
}
