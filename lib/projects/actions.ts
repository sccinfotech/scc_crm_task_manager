'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { encryptAmount, decryptAmount } from '@/lib/amount-encryption'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { computeMemberWorkSeconds } from '@/lib/projects/work-utils'

export type ProjectStatus = 'pending' | 'in_progress' | 'hold' | 'completed'
export type ProjectStaffStatus = 'start' | 'hold' | 'end'
export type ProjectPriority = 'urgent' | 'high' | 'medium' | 'low'

export type ProjectFormData = {
  name: string
  logo_url?: string
  client_id: string
  project_amount?: number
  priority?: ProjectPriority
  start_date: string
  developer_deadline_date?: string
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
  /** Total work seconds (computed from time events) */
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
  start_date: string
  developer_deadline_date: string | null
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
  | 'start_date'
  | 'created_at'
  | 'project_amount'

export type GetProjectsPageOptions = {
  search?: string
  status?: ProjectStatus | 'all'
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
  start_date: string
  developer_deadline_date: string | null
  website_links: string | null
  created_at: string
  created_by?: string
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
  next_follow_up_date?: string
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
  const user = row.users ?? row
  const id = user?.id ?? row?.user_id
  if (!id) return null
  return {
    id,
    full_name: user.full_name ?? null,
    email: user.email ?? null,
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

  let query = supabase
    .from('projects')
    .select(
      'id, name, logo_url, client_id, project_amount, status, priority, start_date, developer_deadline_date, website_links, created_at, created_by, clients(id, name, company_name)',
      { count: 'exact' }
    )

  if (isStaff && !isAdmin) {
    query = supabase
      .from('projects')
      .select(
        'id, name, logo_url, client_id, project_amount, status, priority, start_date, developer_deadline_date, website_links, created_at, created_by, clients(id, name, company_name), project_team_members!inner(user_id)',
        { count: 'exact' }
      )
      .eq('project_team_members.user_id', currentUser.id)
  }

  if (options.search?.trim()) {
    const term = options.search.trim()
    const { data: clientMatches } = await supabase
      .from('clients')
      .select('id')
      .or(`name.ilike.%${term}%,company_name.ilike.%${term}%`)

    const clientIds = (clientMatches as Array<{ id: string }> | null)?.map((c) => c.id) ?? []

    if (clientIds.length > 0) {
      query = query.or(`name.ilike.%${term}%,client_id.in.(${clientIds.join(',')})`)
    } else {
      query = query.ilike('name', `%${term}%`)
    }
  }

  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }

  const sortField = options.sortField ?? 'created_at'
  const sortDirection = options.sortDirection ?? 'desc'
  query = query.order(sortField, { ascending: sortDirection === 'asc' })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Error fetching projects:', error)
    return { data: [], totalCount: 0, error: error.message || 'Failed to fetch projects' }
  }

  const canViewAmount = canViewProjectAmount(currentUser.role)
  const list = (data || []).map((row: any) => {
    const client = normalizeClient(row.clients)
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
      start_date: row.start_date,
      developer_deadline_date: row.developer_deadline_date ?? null,
      website_links: row.website_links ?? null,
      created_at: row.created_at,
      created_by: row.created_by,
    }
  }) as ProjectListItem[]

  return {
    data: list,
    totalCount: count ?? 0,
    error: null,
  }
}

export async function getProject(projectId: string): Promise<{ data: Project | null; error: string | null }> {
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
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(id, name, company_name)')
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
    project_amount: string | null
    status: string
    staff_status?: string | null
    priority?: string | null
    start_date: string
    developer_deadline_date?: string | null
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

  let teamRows: any[] | null = null
  const { data: teamRowsWithWork, error: teamWorkError } = await supabase
    .from('project_team_members')
    .select('user_id, work_status, work_started_at, work_ended_at, work_done_notes, users(id, full_name, email)')
    .eq('project_id', projectId)

  if (!teamWorkError && teamRowsWithWork) {
    teamRows = teamRowsWithWork
  } else {
    const { data: teamRowsBasic } = await supabase
      .from('project_team_members')
      .select('user_id, users(id, full_name, email)')
      .eq('project_id', projectId)
    teamRows = teamRowsBasic || []
  }

  const tools = ((toolRows as Array<{ technology_tools: ProjectTechnologyTool | ProjectTechnologyTool[] }> | null) || [])
    .map((row) => normalizeTool(row.technology_tools))
    .filter((tool): tool is ProjectTechnologyTool => Boolean(tool))

  let teamMembers = ((teamRows as any[]) || []).map((row) => normalizeTeamMember(row)).filter((member): member is ProjectTeamMember => Boolean(member))

  let team_member_time_events: ProjectTeamMemberTimeEvent[] = []
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
  }

  teamMembers = teamMembers.map((m) => {
    const computed = computeMemberWorkSeconds(m.id, team_member_time_events)
    return {
      ...m,
      total_work_seconds: computed.totalSeconds,
      work_running_since: computed.runningSince ?? null,
      work_day_breakdown: computed.dayBreakdown,
    }
  })

  const client = normalizeClient(row.clients)
  const canViewAmount = canViewProjectAmount(currentUser.role)
  const project: Project = {
    id: row.id,
    name: row.name,
    logo_url: row.logo_url,
    client_id: row.client_id,
    project_amount: canViewAmount ? decryptAmount(row.project_amount) : null,
    status: row.status as ProjectStatus,
    staff_status: (row.staff_status ?? null) as ProjectStaffStatus | null,
    priority: (row.priority ?? 'medium') as ProjectPriority,
    start_date: row.start_date,
    developer_deadline_date: row.developer_deadline_date ?? null,
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

  if (!formData.name || !formData.client_id || !formData.start_date) {
    return { data: null, error: 'Project name, client, and start date are required' }
  }

  const developerDeadlineError = validateSingleDate(formData.developer_deadline_date, 'Project deadline date')
  if (developerDeadlineError) {
    return { data: null, error: developerDeadlineError }
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
      start_date: formData.start_date,
      developer_deadline_date: formData.developer_deadline_date || null,
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

  revalidatePath('/dashboard/projects')
  return { data: data as unknown as Project, error: null }
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

  if (!formData.name || !formData.client_id || !formData.start_date) {
    return { data: null, error: 'Project name, client, and start date are required' }
  }

  const developerDeadlineError = validateSingleDate(formData.developer_deadline_date, 'Project deadline date')
  if (developerDeadlineError) {
    return { data: null, error: developerDeadlineError }
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
    start_date: formData.start_date,
    developer_deadline_date: formData.developer_deadline_date || null,
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

  const toolIds = Array.from(new Set(formData.technology_tool_ids ?? [])).filter(Boolean)
  const { error: deleteToolsError } = await supabase
    .from('project_technology_tools')
    .delete()
    .eq('project_id', projectId)

  if (deleteToolsError) {
    console.error('Error clearing project tools:', deleteToolsError)
    return { data: data as unknown as Project, error: deleteToolsError.message || 'Failed to update project tools' }
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
      return { data: data as unknown as Project, error: toolError.message || 'Failed to update project tools' }
    }
  }

  const teamMemberIds = Array.from(new Set(formData.team_member_ids ?? [])).filter(Boolean)
  const { error: deleteTeamError } = await supabase
    .from('project_team_members')
    .delete()
    .eq('project_id', projectId)

  if (deleteTeamError) {
    console.error('Error clearing project team members:', deleteTeamError)
    return { data: data as unknown as Project, error: deleteTeamError.message || 'Failed to update project team members' }
  }

  if (teamMemberIds.length > 0) {
    const teamRows = teamMemberIds.map((memberId) => ({
      project_id: projectId,
      user_id: memberId,
      created_by: currentUser.id,
    }))

    const { error: teamError } = await supabase
      .from('project_team_members')
      .insert(teamRows as never)

    if (teamError) {
      console.error('Error updating project team members:', teamError)
      return { data: data as unknown as Project, error: teamError.message || 'Failed to update project team members' }
    }
  }

  revalidatePath('/dashboard/projects')
  return { data: data as unknown as Project, error: null }
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

export type UpdateMyWorkStatusResult =
  | { data: Project; error: null }
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
  const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
  if (!isAssigned) {
    return { data: null, error: 'You are not assigned to this project' }
  }

  const { data: memberRow } = await supabase
    .from('project_team_members')
    .select('work_status')
    .eq('project_id', projectId)
    .eq('user_id', currentUser.id)
    .single()

  const currentStatus = (memberRow as any)?.work_status ?? 'not_started'
  const validTransitions: Record<string, string[]> = {
    not_started: ['start'],
    start: ['hold', 'end'],
    hold: ['resume', 'end'],
    end: [],
  }
  const allowed = validTransitions[currentStatus] || []
  if (!allowed.includes(eventType)) {
    return { data: null, error: `Cannot ${eventType} from current status (${currentStatus})` }
  }

  const now = new Date().toISOString()
  const { error: eventError } = await supabase.from('project_team_member_time_events').insert({
    project_id: projectId,
    user_id: currentUser.id,
    event_type: eventType,
    occurred_at: now,
    note: eventType === 'end' ? (note ?? null) : null,
  })

  if (eventError) {
    console.error('Error inserting time event:', eventError)
    return { data: null, error: eventError.message || 'Failed to record work event' }
  }

  const updates: Record<string, unknown> = { work_status: eventType === 'resume' ? 'start' : eventType }
  if (eventType === 'start') {
    updates.work_started_at = now
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
  const result = await getProject(projectId)
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
    .select('*')
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
  ;(users as Array<{ id: string; full_name: string | null }> | null)?.forEach((user) => {
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

  if (!formData.note?.trim() && !formData.follow_up_date && !formData.next_follow_up_date) {
    return { data: null, error: 'Please add a note or set a follow-up date (at least one is required)' }
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
      next_follow_up_date: formData.next_follow_up_date || null,
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

  if (!formData.note?.trim() && !formData.follow_up_date && !formData.next_follow_up_date) {
    return { data: null, error: 'Please add a note or set a follow-up date (at least one is required)' }
  }

  const { data, error } = await supabase
    .from('project_followups')
    .update({
      follow_up_date: formData.follow_up_date || null,
      next_follow_up_date: formData.next_follow_up_date || null,
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
