'use server'

import { cache } from 'react'
import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { encryptAmount, decryptAmount } from '@/lib/amount-encryption'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { createActivityLogEntry } from '@/lib/activity-log/logger'
import { computeMemberWorkSeconds, computeWorkHistoryByDay } from '@/lib/projects/work-utils'
import { prepareSearchTerm } from '@/lib/supabase/utils'
import type { WorkHistoryDay, WorkHistorySegment } from '@/lib/projects/work-utils'

export type ProjectStatus = 'pending' | 'in_progress' | 'hold' | 'completed'
export type ProjectStaffStatus = 'start' | 'hold' | 'end'
export type ProjectPriority = 'urgent' | 'high' | 'medium' | 'low'

export type ProjectFormData = {
  name: string
  logo_url?: string
  client_id: string
  project_amount?: number
  priority?: ProjectPriority
  client_deadline_date?: string
  website_links?: string
  reference_links?: string
  technology_tool_ids?: string[]
  team_member_ids?: string[]
}

export type ProjectClientInfo = {
  id: string
  name: string
  company_name: string | null
}

export type ProjectTechnologyTool = {
  id: string
  name: string
}

export type ProjectTeamMemberWorkStatus = 'not_started' | 'start' | 'hold' | 'end'

export type ProjectTeamMember = {
  id: string
  full_name: string | null
  email: string | null
  work_status?: ProjectTeamMemberWorkStatus
  work_started_at?: string | null
  work_ended_at?: string | null
  work_done_notes?: string | null
  /** Current session accumulated seconds (computed from time events) */
  total_work_seconds?: number
  /** When current running segment started (if work_status === 'start') */
  work_running_since?: string | null
  /** Per-day work seconds for analytics */
  work_day_breakdown?: { date: string; seconds: number }[]
}

export type ProjectTeamMemberTimeEvent = {
  user_id: string
  event_type: 'start' | 'hold' | 'resume' | 'end'
  occurred_at: string
  note?: string | null
}

export type Project = {
  id: string
  name: string
  logo_url: string | null
  client_id: string
  project_amount: number | null
  status: ProjectStatus
  staff_status: ProjectStaffStatus | null
  priority: ProjectPriority
  client_deadline_date: string | null
  website_links: string | null
  reference_links: string | null
  created_by: string
  created_at: string
  updated_at: string
  client?: ProjectClientInfo | null
  technology_tools?: ProjectTechnologyTool[]
  team_members?: ProjectTeamMember[]
  team_member_time_events?: ProjectTeamMemberTimeEvent[]
}

export type ProjectSortField =
  | 'name'
  | 'status'
  | 'client_deadline_date'
  | 'follow_up_date'
  | 'created_at'
  | 'project_amount'

export type GetProjectsPageOptions = {
  search?: string
  status?: ProjectStatus | 'all'
  staffUserId?: string
  sortField?: ProjectSortField
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export type ProjectListItem = {
  id: string
  name: string
  logo_url: string | null
  client_id: string
  client_name: string | null
  client_company_name: string | null
  project_amount: number | null
  status: ProjectStatus
  priority?: ProjectPriority
  client_deadline_date: string | null
  website_links: string | null
  created_at: string
  created_by?: string
  /** Next follow-up date from the latest follow-up record (single reminder, same as detail view). */
  follow_up_date: string | null
  /** For staff: current user's work status on this project (only when assigned). */
  my_work_status?: ProjectTeamMemberWorkStatus | null
  /** For staff: when current user started this work session (only when work_status is start). */
  my_work_started_at?: string | null
}

export type ProjectActionResult =
  | { data: Project; error: null }
  | { data: null; error: string }

export type ProjectFollowUp = {
  id: string
  project_id: string
  follow_up_date: string | null
  next_follow_up_date: string | null
  note: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export type ProjectFollowUpsResult =
  | { data: ProjectFollowUp[]; error: null }
  | { data: null; error: string }

export type ProjectFollowUpActionResult =
  | { data: ProjectFollowUp; error: null }
  | { data: null; error: string }

export type ProjectFollowUpFormData = {
  follow_up_date?: string
  note?: string
}

type CloudinaryUploadSignature = {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  folder: string
}

const PROJECT_LOGO_CLOUDINARY_FOLDER = 'scc-crm/project-logos'
const PROJECT_PRIORITY_VALUES: ProjectPriority[] = ['urgent', 'high', 'medium', 'low']

function getEnvVar(name: string, isPublic = false): string {
  const value = process.env[name]
  if (!value) {
    const visibility = isPublic ? 'public' : 'server-only'
    throw new Error(
      `Missing required ${visibility} environment variable: ${name}. ` +
      'Add it to .env.local and restart the dev server.'
    )
  }
  return value
}

function getCloudinaryConfig() {
  const cloudName = getEnvVar('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', true)
  const apiKey = getEnvVar('NEXT_PUBLIC_CLOUDINARY_API_KEY', true)
  const apiSecret = getEnvVar('CLOUDINARY_API_SECRET', false)

  return { cloudName, apiKey, apiSecret }
}

function signCloudinaryParams(params: Record<string, string | number>, apiSecret: string) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return crypto.createHash('sha1').update(sorted + apiSecret).digest('hex')
}

export async function getProjectLogoUploadSignature(): Promise<{
  data: CloudinaryUploadSignature | null
  error: string | null
}> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to upload a logo.' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  if (!canWrite) {
    return { data: null, error: 'You do not have permission to upload a logo.' }
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const folder = PROJECT_LOGO_CLOUDINARY_FOLDER
  const signature = signCloudinaryParams({ timestamp, folder }, apiSecret)

  return {
    data: {
      signature,
      timestamp,
      cloudName,
      apiKey,
      folder,
    },
    error: null,
  }
}

function canViewProjectAmount(role?: string | null) {
  return role === 'admin' || role === 'manager'
}

function isAdminManager(role?: string | null) {
  return role === 'admin' || role === 'manager'
}

function normalizeAmount(value?: number | string | null) {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePriority(value?: string | null): ProjectPriority {
  if (value && PROJECT_PRIORITY_VALUES.includes(value as ProjectPriority)) {
    return value as ProjectPriority
  }
  return 'medium'
}

function normalizeClient(row: any): ProjectClientInfo | null {
  if (!row) return null
  if (Array.isArray(row)) return row[0] ?? null
  return row as ProjectClientInfo
}

function normalizeTool(row: any): ProjectTechnologyTool | null {
  if (!row) return null
  if (Array.isArray(row)) return row[0] ?? null
  return row as ProjectTechnologyTool
}

function normalizeTeamMember(row: any): ProjectTeamMember | null {
  if (!row) return null
  if (Array.isArray(row)) return normalizeTeamMember(row[0])

  // PostgREST might return plural 'users' as an array or object depending on join complexity
  const rawUser = row.users
  const user = Array.isArray(rawUser) ? rawUser[0] : rawUser
  const userData = user ?? row

  // Always prefer user_id from the join if available, then top-level user_id, 
  // then fallback to userData.id (which might be the row PK if join is missing)
  const id = user?.id ?? row?.user_id ?? userData?.id
  if (!id) return null

  return {
    id,
    full_name: userData?.full_name ?? null,
    email: userData?.email ?? null,
    work_status: row.work_status ?? 'not_started',
    work_started_at: row.work_started_at ?? null,
    work_ended_at: row.work_ended_at ?? null,
    work_done_notes: row.work_done_notes ?? null,
  }
}

async function isUserAssignedToProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('project_team_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return false
  }

  const row = data as { user_id?: string } | null
  return Boolean(row?.user_id)
}

function validateSingleDate(value: string | undefined, label: string) {
  if (!value) return `${label} is required`
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return `${label} must be a valid date`
  }
  return null
}

function parseAnalyticsDateInput(value: string | null | undefined, label: string) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return { value: null as string | null, error: null as string | null }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { value: null, error: `${label} must be in YYYY-MM-DD format` }
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    return { value: null, error: `${label} must be a valid date` }
  }

  return { value: trimmed, error: null }
}

export async function getProjectsPage(options: GetProjectsPageOptions = {}) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: [], totalCount: 0, error: 'You must be logged in to view projects' }
  }
  const isAdmin = isAdminManager(currentUser.role)
  const isStaff = currentUser.role === 'staff'
  const canReadModule = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'read')
  if (!isAdmin && !isStaff && !canReadModule) {
    return { data: [], totalCount: 0, error: 'You do not have permission to view projects' }
  }

  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  const supabase = await createClient()
  const staffUserId = options.staffUserId?.trim() || null

  let query = supabase
    .from('projects')
    .select(
      'id, name, logo_url, client_id, project_amount, status, priority, client_deadline_date, website_links, created_at, created_by, clients(id, name, company_name), project_team_members(user_id, work_status, work_started_at)',
      { count: 'exact' }
    )

  if (isStaff && !isAdmin) {
    query = supabase
      .from('projects')
      .select(
        'id, name, logo_url, client_id, project_amount, status, priority, client_deadline_date, website_links, created_at, created_by, clients(id, name, company_name), project_team_members!inner(user_id, work_status, work_started_at)',
        { count: 'exact' }
      )
      .eq('project_team_members.user_id', currentUser.id)
  } else if (staffUserId) {
    query = supabase
      .from('projects')
      .select(
        'id, name, logo_url, client_id, project_amount, status, priority, client_deadline_date, website_links, created_at, created_by, clients(id, name, company_name), project_team_members!inner(user_id, work_status, work_started_at)',
        { count: 'exact' }
      )
      .eq('project_team_members.user_id', staffUserId)
  }

  const searchTerm = prepareSearchTerm(options.search)
  if (searchTerm) {
    // Single query using OR with subquery for client names/companies
    // This is more efficient than the previous 2-step manual filtering
    query = query.or(`name.ilike.%${searchTerm}%,clients.name.ilike.%${searchTerm}%,clients.company_name.ilike.%${searchTerm}%`)
  }

  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }

  const sortField = options.sortField ?? 'created_at'
  const sortDirection = options.sortDirection ?? 'desc'
  // follow_up_date is derived from project_followups, not a column on projects; fall back to created_at
  const orderField = sortField === 'follow_up_date' ? 'created_at' : sortField
  query = query.order(orderField, { ascending: sortDirection === 'asc' })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Error fetching projects:', error)
    return { data: [], totalCount: 0, error: error.message || 'Failed to fetch projects' }
  }

  const canViewAmount = canViewProjectAmount(currentUser.role)
  const projectIds = (data || []).map((row: any) => row.id) as string[]

  // Next follow-up date per project (latest follow-up's follow_up_date, same as detail view setup)
  const followUpDateByProject = new Map<string, string | null>()
  if (projectIds.length > 0) {
    const { data: followUps } = await supabase
      .from('project_followups')
      .select('project_id, follow_up_date, created_at')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })

    const rows = (followUps || []) as Array<{ project_id: string; follow_up_date: string | null }>
    for (const row of rows) {
      if (!followUpDateByProject.has(row.project_id)) {
        followUpDateByProject.set(row.project_id, row.follow_up_date)
      }
    }
  }

  const list = (data || []).map((row: any) => {
    const client = normalizeClient(row.clients)
    const raw = row.project_team_members
    const members = raw ? (Array.isArray(raw) ? raw : [raw]) : []
    const targetUserId = staffUserId || currentUser.id
    const myMember = members.find((m: any) => m.user_id === targetUserId) ?? null

    return {
      id: row.id,
      name: row.name,
      logo_url: row.logo_url,
      client_id: row.client_id,
      client_name: client?.name ?? null,
      client_company_name: client?.company_name ?? null,
      project_amount: canViewAmount ? decryptAmount(row.project_amount) : null,
      status: row.status,
      priority: row.priority ?? 'medium',
      client_deadline_date: row.client_deadline_date ?? null,
      website_links: row.website_links ?? null,
      created_at: row.created_at,
      created_by: row.created_by,
      follow_up_date: followUpDateByProject.get(row.id) ?? null,
      my_work_status: myMember?.work_status ?? null,
      my_work_started_at: myMember?.work_started_at ?? null,
    }
  }) as ProjectListItem[]

  return {
    data: list,
    totalCount: count ?? 0,
    error: null,
  }
}

/** Options for getProject to control data fetch for performance (e.g. defer heavy data when not needed). */
export type GetProjectOptions = {
  /** When false, skips team_member_time_events and work_day_breakdown (for Tasks tab). Default true. */
  includeTimeEvents?: boolean
}

/** Request-scoped cache: deduplicates getProject calls for the same projectId+options within a request */
export const getProject = cache(async (
  projectId: string,
  options?: GetProjectOptions
): Promise<{ data: Project | null; error: string | null }> => {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view a project' }
  }
  const isAdmin = isAdminManager(currentUser.role)
  const isStaff = currentUser.role === 'staff'
  const canReadModule = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'read')
  if (!isAdmin && !isStaff && !canReadModule) {
    return { data: null, error: 'You do not have permission to view this project' }
  }

  const supabase = await createClient()
  if (isStaff && !isAdmin) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'Project not found' }
    }
  }

  const canViewAmount = canViewProjectAmount(currentUser.role)
  const includeTimeEvents = options?.includeTimeEvents !== false

  // Explicit columns only: avoid select('*') for performance. Skip project_amount for staff.
  const projectCols = canViewAmount
    ? 'id, name, logo_url, client_id, project_amount, status, staff_status, priority, client_deadline_date, website_links, reference_links, created_by, created_at, updated_at'
    : 'id, name, logo_url, client_id, status, staff_status, priority, client_deadline_date, website_links, reference_links, created_by, created_at, updated_at'

  const { data, error } = await supabase
    .from('projects')
    .select(`${projectCols}, clients(id, name, company_name)`)
    .eq('id', projectId)
    .single()

  if (error || !data) {
    console.error('Error fetching project:', error)
    return { data: null, error: error?.message || 'Failed to fetch project' }
  }

  type ProjectRow = {
    id: string
    name: string
    logo_url: string | null
    client_id: string
    project_amount?: string | null
    status: string
    staff_status?: string | null
    priority?: string | null
    client_deadline_date?: string | null
    website_links?: string | null
    reference_links?: string | null
    created_by: string
    created_at: string
    updated_at: string
    clients?: unknown
  }
  const row = data as ProjectRow

  const { data: toolRows } = await supabase
    .from('project_technology_tools')
    .select('technology_tools(id, name)')
    .eq('project_id', projectId)

  // Only work_status needed for display; work_started_at/ended_at/done_notes not used in detail view
  let teamRows: any[] | null = null
  const { data: teamRowsWithWork, error: teamWorkError } = await supabase
    .from('project_team_members')
    .select('user_id, work_status, users!user_id(id, full_name, email)')
    .eq('project_id', projectId)

  if (!teamWorkError && teamRowsWithWork) {
    teamRows = teamRowsWithWork
  } else {
    if (teamWorkError) {
      console.warn('Falling back to basic project_team_members fetch due to error:', teamWorkError.message)
    }
    const { data: teamRowsBasic } = await supabase
      .from('project_team_members')
      .select('user_id, users!user_id(id, full_name, email)')
      .eq('project_id', projectId)
    teamRows = teamRowsBasic || []
  }

  const tools = ((toolRows as Array<{ technology_tools: ProjectTechnologyTool | ProjectTechnologyTool[] }> | null) || [])
    .map((r) => normalizeTool(r.technology_tools))
    .filter((tool): tool is ProjectTechnologyTool => Boolean(tool))

  let teamMembers = ((teamRows as any[]) || []).map((row) => normalizeTeamMember(row)).filter((member): member is ProjectTeamMember => Boolean(member))

  let team_member_time_events: ProjectTeamMemberTimeEvent[] = []
  if (includeTimeEvents) {
    const { data: timeEventRows, error: timeEventsError } = await supabase
      .from('project_team_member_time_events')
      .select('user_id, event_type, occurred_at, note')
      .eq('project_id', projectId)
      .order('occurred_at', { ascending: true })

    if (!timeEventsError && timeEventRows) {
      team_member_time_events = timeEventRows.map((e: any) => ({
        user_id: e.user_id,
        event_type: e.event_type,
        occurred_at: e.occurred_at,
        note: e.note ?? null,
      }))

      teamMembers = teamMembers.map((m) => {
        const computed = computeMemberWorkSeconds(m.id, team_member_time_events)
        return {
          ...m,
          total_work_seconds: computed.totalSeconds,
          work_running_since: computed.runningSince ?? null,
          work_day_breakdown: computed.dayBreakdown,
        }
      })
    }
  }

  const client = normalizeClient(row.clients)
  const project: Project = {
    id: row.id,
    name: row.name,
    logo_url: row.logo_url,
    client_id: row.client_id,
    project_amount: canViewAmount && row.project_amount != null ? decryptAmount(row.project_amount) : null,
    status: row.status as ProjectStatus,
    staff_status: (row.staff_status ?? null) as ProjectStaffStatus | null,
    priority: (row.priority ?? 'medium') as ProjectPriority,
    client_deadline_date: row.client_deadline_date ?? null,
    website_links: row.website_links ?? null,
    reference_links: row.reference_links ?? null,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    client: client
      ? {
        id: client.id,
        name: client.name,
        company_name: client.company_name ?? null,
      }
      : null,
    technology_tools: tools,
    team_members: teamMembers,
    team_member_time_events,
  }

  return { data: project, error: null }
})

/** Supplement for Details tab: fetches team_member_time_events and computes work stats. Call when user opens Details tab and project was loaded with includeTimeEvents: false. */
export async function getProjectDetailsSupplement(
  projectId: string
): Promise<{ data: { team_members: ProjectTeamMember[]; team_member_time_events: ProjectTeamMemberTimeEvent[] } | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in' }
  }
  const canReadModule = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'read')
  const isAdmin = isAdminManager(currentUser.role)
  const isStaff = currentUser.role === 'staff'
  if (!isAdmin && !isStaff && !canReadModule) {
    return { data: null, error: 'You do not have permission' }
  }

  const supabase = await createClient()
  if (isStaff && !isAdmin) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) return { data: null, error: 'Project not found' }
  }

  const [teamRes, timeEventsRes] = await Promise.all([
    supabase
      .from('project_team_members')
      .select('user_id, work_status, users!user_id(id, full_name, email)')
      .eq('project_id', projectId),
    supabase
      .from('project_team_member_time_events')
      .select('user_id, event_type, occurred_at, note')
      .eq('project_id', projectId)
      .order('occurred_at', { ascending: true }),
  ])

  if (teamRes.error) {
    return { data: null, error: teamRes.error.message ?? 'Failed to fetch team members' }
  }
  if (timeEventsRes.error) {
    return { data: null, error: timeEventsRes.error.message ?? 'Failed to fetch time events' }
  }

  const teamRows = (teamRes.data as any[]) || []
  const timeEventRows = (timeEventsRes.data as any[]) || []
  const team_member_time_events: ProjectTeamMemberTimeEvent[] = timeEventRows.map((e: any) => ({
    user_id: e.user_id,
    event_type: e.event_type,
    occurred_at: e.occurred_at,
    note: e.note ?? null,
  }))

  const teamMembers = teamRows
    .map((row) => normalizeTeamMember(row))
    .filter((m): m is ProjectTeamMember => Boolean(m))
    .map((m) => {
      const computed = computeMemberWorkSeconds(m.id, team_member_time_events)
      return {
        ...m,
        total_work_seconds: computed.totalSeconds,
        work_running_since: computed.runningSince ?? null,
        work_day_breakdown: computed.dayBreakdown,
      }
    })

  return { data: { team_members: teamMembers, team_member_time_events }, error: null }
}

export async function createProject(formData: ProjectFormData): Promise<ProjectActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to create a project' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  const isAdmin = isAdminManager(currentUser.role)
  if (!canWrite && !isAdmin) {
    return { data: null, error: 'You do not have permission to create projects' }
  }

  if (!formData.name || !formData.client_id) {
    return { data: null, error: 'Project name and client are required' }
  }

  const clientDeadlineError = validateSingleDate(formData.client_deadline_date, 'Client deadline date')
  if (clientDeadlineError) {
    return { data: null, error: clientDeadlineError }
  }

  const canViewAmount = canViewProjectAmount(currentUser.role)
  const amount = canViewAmount ? normalizeAmount(formData.project_amount) : null
  if (amount !== null && amount < 0) {
    return { data: null, error: 'Project amount must be zero or greater' }
  }

  const priority: ProjectPriority = normalizePriority(formData.priority)
  const websiteLinks = formData.website_links?.trim() || null
  const referenceLinks = formData.reference_links?.trim() || null
  const toolIds = Array.from(new Set(formData.technology_tool_ids ?? [])).filter(Boolean)
  const teamMemberIds = Array.from(new Set(formData.team_member_ids ?? [])).filter(Boolean)

  const supabase = await createClient()
  const encryptedAmount = amount !== null ? encryptAmount(amount) : null
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: formData.name.trim(),
      logo_url: formData.logo_url?.trim() || null,
      client_id: formData.client_id,
      project_amount: encryptedAmount,
      status: 'pending',
      staff_status: 'start',
      priority,
      client_deadline_date: formData.client_deadline_date || null,
      website_links: websiteLinks,
      reference_links: referenceLinks,
      created_by: currentUser.id,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    return { data: null, error: error.message || 'Failed to create project' }
  }

  if (toolIds.length > 0) {
    const toolRows = toolIds.map((toolId) => ({
      project_id: (data as { id: string }).id,
      technology_tool_id: toolId,
      created_by: currentUser.id,
    }))

    const { error: toolError } = await supabase
      .from('project_technology_tools')
      .insert(toolRows as never)

    if (toolError) {
      console.error('Error adding project tools:', toolError)
      await supabase.from('projects').delete().eq('id', (data as { id: string }).id)
      return { data: null, error: toolError.message || 'Failed to save project tools' }
    }
  }

  if (teamMemberIds.length > 0) {
    const teamRows = teamMemberIds.map((memberId) => ({
      project_id: (data as { id: string }).id,
      user_id: memberId,
      created_by: currentUser.id,
    }))

    const { error: teamError } = await supabase
      .from('project_team_members')
      .insert(teamRows as never)

    if (teamError) {
      console.error('Error adding project team members:', teamError)
      await supabase.from('projects').delete().eq('id', (data as { id: string }).id)
      return { data: null, error: teamError.message || 'Failed to save project team members' }
    }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Create',
    moduleName: 'Projects',
    recordId: (data as { id: string }).id,
    description: `Created project "${formData.name}"`,
    status: 'Success',
  })
  revalidatePath('/dashboard/projects')
  const result = await getProject((data as { id: string }).id)
  if (result.error || !result.data) {
    return { data: null, error: result.error || 'Project created but failed to load complete details' }
  }
  return { data: result.data, error: null }
}

export async function updateProject(projectId: string, formData: ProjectFormData): Promise<ProjectActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update a project' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  const isAdmin = isAdminManager(currentUser.role)
  if (!canWrite && !isAdmin) {
    return { data: null, error: 'You do not have permission to update this project' }
  }

  const supabase = await createClient()
  const { data: existingProject, error: fetchError } = await supabase
    .from('projects')
    .select('id, priority')
    .eq('id', projectId)
    .single()

  if (fetchError || !existingProject) {
    return { data: null, error: 'Project not found' }
  }

  if (!formData.name || !formData.client_id) {
    return { data: null, error: 'Project name and client are required' }
  }

  const clientDeadlineError = validateSingleDate(formData.client_deadline_date, 'Client deadline date')
  if (clientDeadlineError) {
    return { data: null, error: clientDeadlineError }
  }

  const priority: ProjectPriority =
    normalizePriority(formData.priority ?? (existingProject as { priority: ProjectPriority | null }).priority ?? 'medium')
  const websiteLinks = formData.website_links?.trim() || null
  const referenceLinks = formData.reference_links?.trim() || null

  const updatePayload: Record<string, unknown> = {
    name: formData.name.trim(),
    logo_url: formData.logo_url?.trim() || null,
    client_id: formData.client_id,
    client_deadline_date: formData.client_deadline_date || null,
    website_links: websiteLinks,
    reference_links: referenceLinks,
    priority,
  }

  const canViewAmount = canViewProjectAmount(currentUser.role)
  if (canViewAmount) {
    const amount = normalizeAmount(formData.project_amount)
    if (amount !== null && amount < 0) {
      return { data: null, error: 'Project amount must be zero or greater' }
    }
    updatePayload.project_amount = amount !== null ? encryptAmount(amount) : null
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updatePayload as never)
    .eq('id', projectId)
    .select()
    .single()

  if (error) {
    console.error('Error updating project:', error)
    return { data: null, error: error.message || 'Failed to update project' }
  }

  const project = data as unknown as Project
  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Update',
    moduleName: 'Projects',
    recordId: projectId,
    description: `Updated project "${project.name}"`,
    status: 'Success',
  })

  const toolIds = Array.from(new Set(formData.technology_tool_ids ?? [])).filter(Boolean)
  const { error: deleteToolsError } = await supabase
    .from('project_technology_tools')
    .delete()
    .eq('project_id', projectId)

  if (deleteToolsError) {
    console.error('Error clearing project tools:', deleteToolsError)
    return { data: null, error: deleteToolsError.message || 'Failed to update project tools' }
  }

  if (toolIds.length > 0) {
    const toolRows = toolIds.map((toolId) => ({
      project_id: projectId,
      technology_tool_id: toolId,
      created_by: currentUser.id,
    }))

    const { error: toolError } = await supabase
      .from('project_technology_tools')
      .insert(toolRows as never)

    if (toolError) {
      console.error('Error updating project tools:', toolError)
      return { data: null, error: toolError.message || 'Failed to update project tools' }
    }
  }

  // Preserve existing member work state (status/timestamps/notes) for unchanged members.
  // Only remove de-selected users and insert newly selected users.
  if (formData.team_member_ids !== undefined) {
    const nextTeamMemberIds = Array.from(new Set(formData.team_member_ids)).filter(Boolean)
    const { data: existingTeamRows, error: existingTeamError } = await supabase
      .from('project_team_members')
      .select('user_id')
      .eq('project_id', projectId)

    if (existingTeamError) {
      console.error('Error fetching existing project team members:', existingTeamError)
      return { data: null, error: existingTeamError.message || 'Failed to read project team members' }
    }

    const existingTeamMemberIds = new Set(
      ((existingTeamRows as Array<{ user_id: string }> | null) ?? []).map((row) => row.user_id)
    )
    const nextTeamMemberIdSet = new Set(nextTeamMemberIds)
    const teamMemberIdsToDelete = Array.from(existingTeamMemberIds).filter((memberId) => !nextTeamMemberIdSet.has(memberId))
    const teamMemberIdsToInsert = nextTeamMemberIds.filter((memberId) => !existingTeamMemberIds.has(memberId))

    if (teamMemberIdsToDelete.length > 0) {
      const { error: deleteTeamError } = await supabase
        .from('project_team_members')
        .delete()
        .eq('project_id', projectId)
        .in('user_id', teamMemberIdsToDelete)

      if (deleteTeamError) {
        console.error('Error removing project team members:', deleteTeamError)
        return { data: null, error: deleteTeamError.message || 'Failed to update project team members' }
      }
    }

    if (teamMemberIdsToInsert.length > 0) {
      const teamRows = teamMemberIdsToInsert.map((memberId) => ({
        project_id: projectId,
        user_id: memberId,
        created_by: currentUser.id,
      }))

      const { error: teamError } = await supabase
        .from('project_team_members')
        .insert(teamRows as never)

      if (teamError) {
        console.error('Error adding project team members:', teamError)
        return { data: null, error: teamError.message || 'Failed to update project team members' }
      }
    }
  }

  revalidatePath('/dashboard/projects')
  revalidatePath(`/dashboard/projects/${projectId}`)
  const result = await getProject(projectId)
  if (result.error || !result.data) {
    return { data: null, error: result.error || 'Project updated but failed to load complete details' }
  }
  return { data: result.data, error: null }
}

export type UpdateProjectLinksPayload = {
  website_links?: string | null
  reference_links?: string | null
}

export type UpdateProjectLinksResult =
  | { data: true; error: null }
  | { data: null; error: string }

/**
 * Updates only website_links and reference_links for a project. Admin/Manager or project write permission.
 */
export async function updateProjectLinks(
  projectId: string,
  payload: UpdateProjectLinksPayload
): Promise<UpdateProjectLinksResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update project links' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  const isAdmin = isAdminManager(currentUser.role)
  if (!canWrite && !isAdmin) {
    return { data: null, error: 'You do not have permission to update project links' }
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (!existing) {
    return { data: null, error: 'Project not found' }
  }

  const updatePayload: Record<string, string | null> = {}
  if (payload.website_links !== undefined) {
    updatePayload.website_links = payload.website_links?.trim() || null
  }
  if (payload.reference_links !== undefined) {
    updatePayload.reference_links = payload.reference_links?.trim() || null
  }

  if (Object.keys(updatePayload).length === 0) {
    return { data: true, error: null }
  }

  const { error } = await supabase
    .from('projects')
    .update(updatePayload as never)
    .eq('id', projectId)

  if (error) {
    console.error('Error updating project links:', error)
    return { data: null, error: error.message || 'Failed to update links' }
  }

  revalidatePath('/dashboard/projects')
  revalidatePath(`/dashboard/projects/${projectId}`)
  return { data: true, error: null }
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<ProjectActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update a project' }
  }

  if (!isAdminManager(currentUser.role)) {
    return { data: null, error: 'You do not have permission to update project status' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('projects')
    .update({ status } as never)
    .eq('id', projectId)

  if (error) {
    console.error('Error updating project status:', error)
    return { data: null, error: error.message || 'Failed to update project status' }
  }

  revalidatePath('/dashboard/projects')
  revalidatePath(`/dashboard/projects/${projectId}`)
  const result = await getProject(projectId)
  return result.error ? { data: null, error: result.error } : { data: result.data!, error: null }
}

export async function updateProjectStaffStatus(
  projectId: string,
  staffStatus: ProjectStaffStatus
): Promise<ProjectActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update a project' }
  }

  const supabase = await createClient()
  const isAdmin = isAdminManager(currentUser.role)
  if (!isAdmin) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to update staff status' }
    }
  }

  const { error } = await supabase
    .from('projects')
    .update({ staff_status: staffStatus } as never)
    .eq('id', projectId)

  if (error) {
    console.error('Error updating project staff status:', error)
    return { data: null, error: error.message || 'Failed to update staff status' }
  }

  revalidatePath('/dashboard/projects')
  revalidatePath(`/dashboard/projects/${projectId}`)
  const result = await getProject(projectId)
  return result.error ? { data: null, error: result.error } : { data: result.data!, error: null }
}

/** Lightweight response: team members with work stats. Client merges into project instead of full refetch. */
export type UpdateMyWorkStatusSupplement = {
  team_members: ProjectTeamMember[]
  team_member_time_events: ProjectTeamMemberTimeEvent[]
}

export type UpdateMyWorkStatusResult =
  | { data: UpdateMyWorkStatusSupplement; error: null }
  | { data: null; error: string }

export async function updateMyProjectWorkStatus(
  projectId: string,
  eventType: 'start' | 'hold' | 'resume' | 'end',
  note?: string | null
): Promise<UpdateMyWorkStatusResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update work status' }
  }

  const supabase = await createClient()
  const [isAssigned, memberRes] = await Promise.all([
    isUserAssignedToProject(supabase, projectId, currentUser.id),
    supabase
      .from('project_team_members')
      .select('work_status')
      .eq('project_id', projectId)
      .eq('user_id', currentUser.id)
      .single(),
  ])

  if (!isAssigned) {
    return { data: null, error: 'You are not assigned to this project' }
  }

  const currentStatus = (memberRes.data as any)?.work_status ?? 'not_started'
  const validTransitions: Record<string, string[]> = {
    not_started: ['start'],
    start: ['hold', 'end'],
    hold: ['resume', 'end'],
    end: ['start'], // can start again next day or same day (repetitive process)
  }
  const allowed = validTransitions[currentStatus] || []
  if (!allowed.includes(eventType)) {
    return { data: null, error: `Cannot ${eventType} from current status (${currentStatus})` }
  }

  if (eventType === 'end' && (!note || !note.trim())) {
    return { data: null, error: 'Done points are required. Please describe what you completed before ending work.' }
  }

  const now = new Date().toISOString()
  const { error: eventError } = await supabase
    .from('project_team_member_time_events')
    .insert({
      project_id: projectId,
      user_id: currentUser.id,
      event_type: eventType,
      occurred_at: now,
      note: eventType === 'end' ? (note ?? null) : null,
    } as never)

  if (eventError) {
    console.error('Error inserting time event:', eventError)
    return { data: null, error: eventError.message || 'Failed to record work event' }
  }

  const updates: Record<string, unknown> = { work_status: eventType === 'resume' ? 'start' : eventType }
  if (eventType === 'start') {
    updates.work_started_at = now
    // clear previous session end data when starting a new session
    updates.work_ended_at = null
    updates.work_done_notes = null
  }
  if (eventType === 'end') {
    updates.work_ended_at = now
    updates.work_done_notes = note ?? null
  }

  const { error: updateError } = await supabase
    .from('project_team_members')
    .update(updates as never)
    .eq('project_id', projectId)
    .eq('user_id', currentUser.id)

  if (updateError) {
    console.error('Error updating team member work status:', updateError)
    return { data: null, error: updateError.message || 'Failed to update work status' }
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')
  const result = await getProjectDetailsSupplement(projectId)
  return result.error ? { data: null, error: result.error } : { data: result.data!, error: null }
}

export async function deleteProject(projectId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'You must be logged in to delete a project' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  if (!canWrite) {
    return { error: 'You do not have permission to delete this project' }
  }

  const supabase = await createClient()
  const { data: existingProject, error: fetchError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (fetchError || !existingProject) {
    return { error: 'Project not found' }
  }

  const { error } = await supabase.from('projects').delete().eq('id', projectId)

  if (error) {
    console.error('Error deleting project:', error)
    return { error: error.message || 'Failed to delete project' }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Delete',
    moduleName: 'Projects',
    recordId: projectId,
    description: 'Deleted project',
    status: 'Success',
  })
  revalidatePath('/dashboard/projects')
  return { error: null }
}

export async function getProjectFollowUps(projectId: string): Promise<ProjectFollowUpsResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view follow-ups' }
  }
  const canReadModule = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'read')
  const isAdmin = isAdminManager(currentUser.role)

  const supabase = await createClient()
  if (!isAdmin && !canReadModule) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to view follow-ups' }
    }
  }
  const { data: followUps, error } = await supabase
    .from('project_followups')
    .select('id, project_id, follow_up_date, next_follow_up_date, note, created_by, created_at, updated_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching project follow-ups:', error)
    return { data: null, error: error.message || 'Failed to fetch follow-ups' }
  }

  if (!followUps || followUps.length === 0) {
    return { data: [], error: null }
  }

  const followUpsList = followUps as Array<{
    id: string
    project_id: string
    follow_up_date: string | null
    next_follow_up_date: string | null
    note: string | null
    created_by: string
    created_at: string
    updated_at: string
  }>

  const userIds = [...new Set(followUpsList.map((fu) => fu.created_by))]
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', userIds)

  const userMap = new Map<string, string>()
    ; (users as Array<{ id: string; full_name: string | null }> | null)?.forEach((user) => {
      userMap.set(user.id, user.full_name || 'Unknown User')
    })

  const transformedData = followUpsList.map((item) => ({
    id: item.id,
    project_id: item.project_id,
    follow_up_date: item.follow_up_date,
    next_follow_up_date: item.next_follow_up_date,
    note: item.note,
    created_by: item.created_by,
    created_by_name: userMap.get(item.created_by) || 'Unknown User',
    created_at: item.created_at,
    updated_at: item.updated_at,
  }))

  return { data: transformedData, error: null }
}

export type ProjectWorkHistoryTeamMemberDay = {
  userId: string
  userName: string | null
  userEmail: string | null
  totalSeconds: number
  segments: WorkHistorySegment[]
}

export type ProjectWorkHistoryTeamDay = {
  date: string
  totalSeconds: number
  members: ProjectWorkHistoryTeamMemberDay[]
}

export type ProjectWorkHistoryPayload =
  | { mode: 'single'; days: WorkHistoryDay[] }
  | { mode: 'team'; days: ProjectWorkHistoryTeamDay[] }

export type ProjectWorkHistoryResult =
  | { data: ProjectWorkHistoryPayload; error: null }
  | { data: null; error: string }

export type ProjectAnalyticsStaffTime = {
  userId: string
  userName: string | null
  userEmail: string | null
  totalSeconds: number
}

export type ProjectAnalyticsPayload = {
  fromDate: string | null
  toDate: string | null
  totalSeconds: number
  staffTotals: ProjectAnalyticsStaffTime[]
}

export type ProjectAnalyticsResult =
  | { data: ProjectAnalyticsPayload; error: null }
  | { data: null; error: string }

/**
 * Returns work history (by day, with segments and notes) for a project.
 * Data source: project_team_member_time_events (event_type: start, hold, resume, end; note on end).
 * Staff: always current user.
 * Admin/Manager: returns all users' work history grouped by date.
 * Others: optional staffUserId to view a single assigned user's history.
 */
export async function getProjectWorkHistory(
  projectId: string,
  staffUserId?: string | null
): Promise<ProjectWorkHistoryResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view work history' }
  }
  const canReadModule = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'read')
  const isAdmin = isAdminManager(currentUser.role)

  const supabase = await createClient()
  if (!isAdmin && !canReadModule) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to view work history' }
    }
  }

  if (currentUser.role === 'staff' && staffUserId && staffUserId !== currentUser.id) {
    return { data: null, error: 'You can only view your own work history' }
  }

  const { data: timeEventRows, error: timeEventsError } = await supabase
    .from('project_team_member_time_events')
    .select('user_id, event_type, occurred_at, note')
    .eq('project_id', projectId)
    .order('occurred_at', { ascending: true })

  if (timeEventsError) {
    console.error('Error fetching work history:', timeEventsError)
    return { data: null, error: timeEventsError.message || 'Failed to fetch work history' }
  }

  const events = (timeEventRows || []).map((e: { user_id: string; event_type: string; occurred_at: string; note?: string | null }) => ({
    user_id: e.user_id,
    event_type: e.event_type,
    occurred_at: e.occurred_at,
    note: e.note ?? null,
  }))

  const isTeamViewRole = currentUser.role === 'admin' || currentUser.role === 'manager'
  if (isTeamViewRole) {
    const userIds = [...new Set(events.map((event) => event.user_id))]
    if (userIds.length === 0) {
      return { data: { mode: 'team', days: [] }, error: null }
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', userIds)

    if (usersError) {
      console.error('Error fetching work history users:', usersError)
      return { data: null, error: usersError.message || 'Failed to fetch work history users' }
    }

    const userMap = new Map<string, { name: string | null; email: string | null }>()
      ; (users as Array<{ id: string; full_name: string | null; email: string | null }> | null)?.forEach((user) => {
        userMap.set(user.id, { name: user.full_name, email: user.email })
      })

    const dayMap = new Map<string, ProjectWorkHistoryTeamDay>()
    for (const userId of userIds) {
      const userDays = computeWorkHistoryByDay(userId, events)
      if (userDays.length === 0) continue

      const userInfo = userMap.get(userId)
      for (const day of userDays) {
        const existing = dayMap.get(day.date)
        const memberDay: ProjectWorkHistoryTeamMemberDay = {
          userId,
          userName: userInfo?.name ?? null,
          userEmail: userInfo?.email ?? null,
          totalSeconds: day.totalSeconds,
          segments: day.segments,
        }

        if (!existing) {
          dayMap.set(day.date, {
            date: day.date,
            totalSeconds: day.totalSeconds,
            members: [memberDay],
          })
        } else {
          existing.totalSeconds += day.totalSeconds
          existing.members.push(memberDay)
        }
      }
    }

    const days = Array.from(dayMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((day) => ({
        ...day,
        members: day.members.sort((a, b) => {
          const aLabel = (a.userName ?? a.userEmail ?? a.userId).toLowerCase()
          const bLabel = (b.userName ?? b.userEmail ?? b.userId).toLowerCase()
          return aLabel.localeCompare(bLabel)
        }),
      }))

    return { data: { mode: 'team', days }, error: null }
  }

  const userId = staffUserId || currentUser.id
  if (userId !== currentUser.id) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, userId)
    if (!isAssigned) {
      return { data: null, error: 'Selected staff is not assigned to this project' }
    }
  }

  const days = computeWorkHistoryByDay(userId, events)
  return { data: { mode: 'single', days }, error: null }
}

/**
 * Project analytics for Admin/Manager: total time spent and staff-wise totals,
 * with optional inclusive date-range filtering by day key (YYYY-MM-DD).
 */
export async function getProjectAnalytics(
  projectId: string,
  options?: { fromDate?: string | null; toDate?: string | null }
): Promise<ProjectAnalyticsResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view project analytics' }
  }

  if (!isAdminManager(currentUser.role)) {
    return { data: null, error: 'Only admins and managers can view project analytics' }
  }

  const fromDateValidation = parseAnalyticsDateInput(options?.fromDate, 'From date')
  if (fromDateValidation.error) {
    return { data: null, error: fromDateValidation.error }
  }

  const toDateValidation = parseAnalyticsDateInput(options?.toDate, 'To date')
  if (toDateValidation.error) {
    return { data: null, error: toDateValidation.error }
  }

  const fromDate = fromDateValidation.value
  const toDate = toDateValidation.value
  if (fromDate && toDate && fromDate > toDate) {
    return { data: null, error: 'From date must be earlier than or equal to To date' }
  }

  const supabase = await createClient()

  const { data: projectRow, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()

  if (projectError) {
    console.error('Error validating project for analytics:', projectError)
    return { data: null, error: projectError.message || 'Failed to validate project' }
  }

  if (!projectRow) {
    return { data: null, error: 'Project not found' }
  }

  const { data: teamRows, error: teamError } = await supabase
    .from('project_team_members')
    .select('user_id, users!user_id(id, full_name, email)')
    .eq('project_id', projectId)

  if (teamError) {
    console.error('Error fetching project team members for analytics:', teamError)
    return { data: null, error: teamError.message || 'Failed to fetch project team members' }
  }

  const userMetaById = new Map<
    string,
    { userName: string | null; userEmail: string | null; isAssigned: boolean }
  >()

    ; (teamRows as Array<{ user_id: string; users?: { id?: string; full_name?: string | null; email?: string | null } | Array<{ id?: string; full_name?: string | null; email?: string | null }> }> | null)?.forEach((row) => {
      const userNode = Array.isArray(row.users) ? row.users[0] : row.users
      const userId = userNode?.id ?? row.user_id
      if (!userId) return
      userMetaById.set(userId, {
        userName: userNode?.full_name ?? null,
        userEmail: userNode?.email ?? null,
        isAssigned: true,
      })
    })

  const { data: timeEventRows, error: timeEventsError } = await supabase
    .from('project_team_member_time_events')
    .select('user_id, event_type, occurred_at, note')
    .eq('project_id', projectId)
    .order('occurred_at', { ascending: true })

  if (timeEventsError) {
    console.error('Error fetching project analytics time events:', timeEventsError)
    return { data: null, error: timeEventsError.message || 'Failed to fetch project analytics' }
  }

  const events = (timeEventRows || []).map(
    (event: { user_id: string; event_type: string; occurred_at: string; note?: string | null }) => ({
      user_id: event.user_id,
      event_type: event.event_type,
      occurred_at: event.occurred_at,
      note: event.note ?? null,
    })
  )

  const missingEventUserIds = [...new Set(events.map((event) => event.user_id))]
    .filter((userId) => !userMetaById.has(userId))

  if (missingEventUserIds.length > 0) {
    const { data: missingUsers, error: missingUsersError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', missingEventUserIds)

    if (missingUsersError) {
      console.error('Error fetching analytics users:', missingUsersError)
      return { data: null, error: missingUsersError.message || 'Failed to fetch analytics users' }
    }

    ; (missingUsers as Array<{ id: string; full_name: string | null; email: string | null }> | null)?.forEach((user) => {
      userMetaById.set(user.id, {
        userName: user.full_name,
        userEmail: user.email,
        isAssigned: false,
      })
    })
  }

  const shouldIncludeDay = (dayKey: string) => {
    if (fromDate && dayKey < fromDate) return false
    if (toDate && dayKey > toDate) return false
    return true
  }

  const staffTotals: ProjectAnalyticsStaffTime[] = []
  for (const [userId, meta] of userMetaById.entries()) {
    const dayHistory = computeWorkHistoryByDay(userId, events)
    const totalSeconds = dayHistory.reduce((sum, day) => (
      shouldIncludeDay(day.date) ? sum + day.totalSeconds : sum
    ), 0)

    if (totalSeconds > 0 || meta.isAssigned) {
      staffTotals.push({
        userId,
        userName: meta.userName,
        userEmail: meta.userEmail,
        totalSeconds,
      })
    }
  }

  staffTotals.sort((a, b) => {
    if (b.totalSeconds !== a.totalSeconds) {
      return b.totalSeconds - a.totalSeconds
    }
    const aLabel = (a.userName ?? a.userEmail ?? a.userId).toLowerCase()
    const bLabel = (b.userName ?? b.userEmail ?? b.userId).toLowerCase()
    return aLabel.localeCompare(bLabel)
  })

  const totalSeconds = staffTotals.reduce((sum, staff) => sum + staff.totalSeconds, 0)
  return {
    data: {
      fromDate,
      toDate,
      totalSeconds,
      staffTotals,
    },
    error: null,
  }
}

export async function createProjectFollowUp(
  projectId: string,
  formData: ProjectFollowUpFormData
): Promise<ProjectFollowUpActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to create a follow-up' }
  }
  const canWriteModule = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  const isAdmin = isAdminManager(currentUser.role)

  if (!formData.note?.trim() && !formData.follow_up_date) {
    return { data: null, error: 'Please add a note or set a reminder date (at least one is required)' }
  }

  const supabase = await createClient()
  if (!isAdmin && !canWriteModule) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to create follow-ups' }
    }
  }
  const { data, error } = await supabase
    .from('project_followups')
    .insert({
      project_id: projectId,
      follow_up_date: formData.follow_up_date || null,
      next_follow_up_date: null,
      note: formData.note?.trim() || null,
      created_by: currentUser.id,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating follow-up:', error)
    return { data: null, error: error.message || 'Failed to create follow-up' }
  }

  revalidatePath('/dashboard/projects')
  return { data: data as unknown as ProjectFollowUp, error: null }
}

export async function updateProjectFollowUp(
  followUpId: string,
  formData: ProjectFollowUpFormData
): Promise<ProjectFollowUpActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update a follow-up' }
  }
  const canWriteModule = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  const isAdmin = isAdminManager(currentUser.role)

  const supabase = await createClient()
  const { data: existingFollowUp, error: fetchError } = await supabase
    .from('project_followups')
    .select('project_id')
    .eq('id', followUpId)
    .single()

  if (fetchError || !existingFollowUp) {
    return { data: null, error: 'Follow-up not found' }
  }

  if (!isAdmin && !canWriteModule) {
    const isAssigned = await isUserAssignedToProject(
      supabase,
      (existingFollowUp as { project_id: string }).project_id,
      currentUser.id
    )
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to update follow-ups' }
    }
  }

  if (!formData.note?.trim() && !formData.follow_up_date) {
    return { data: null, error: 'Please add a note or set a reminder date (at least one is required)' }
  }

  const { data, error } = await supabase
    .from('project_followups')
    .update({
      follow_up_date: formData.follow_up_date || null,
      next_follow_up_date: null,
      note: formData.note?.trim() || null,
    } as never)
    .eq('id', followUpId)
    .select()
    .single()

  if (error) {
    console.error('Error updating follow-up:', error)
    return { data: null, error: error.message || 'Failed to update follow-up' }
  }

  revalidatePath('/dashboard/projects')
  return { data: data as unknown as ProjectFollowUp, error: null }
}

export async function deleteProjectFollowUp(followUpId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'You must be logged in to delete a follow-up' }
  }
  const canWriteModule = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  const isAdmin = isAdminManager(currentUser.role)

  const supabase = await createClient()
  const { data: existingFollowUp, error: fetchError } = await supabase
    .from('project_followups')
    .select('project_id')
    .eq('id', followUpId)
    .single()

  if (fetchError || !existingFollowUp) {
    return { error: 'Follow-up not found' }
  }

  if (!isAdmin && !canWriteModule) {
    const isAssigned = await isUserAssignedToProject(
      supabase,
      (existingFollowUp as { project_id: string }).project_id,
      currentUser.id
    )
    if (!isAssigned) {
      return { error: 'You do not have permission to delete follow-ups' }
    }
  }

  const { error } = await supabase
    .from('project_followups')
    .delete()
    .eq('id', followUpId)

  if (error) {
    console.error('Error deleting follow-up:', error)
    return { error: error.message || 'Failed to delete follow-up' }
  }

  revalidatePath('/dashboard/projects')
  return { error: null }
}
