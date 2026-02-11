'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import {
  TASK_STATUSES,
  TASK_ALLOWED_MIME_TYPES,
  TASK_CLOUDINARY_FOLDER,
  TASK_MAX_ATTACHMENT_SIZE_BYTES,
  type TaskStatus,
  type TaskPriority,
  type TaskType,
} from './tasks-constants'

export type TaskAssignee = {
  id: string
  full_name: string | null
  email: string | null
}

export type ProjectTaskListItem = {
  id: string
  project_id: string
  title: string
  description_html: string | null
  task_type: TaskType | null
  priority: TaskPriority | null
  status: TaskStatus
  due_date: string | null
  created_by: string
  created_at: string
  updated_at: string
  in_progress_at: string | null
  completed_at: string | null
  actual_minutes: number | null
  assignees: TaskAssignee[]
}

export type TaskAttachment = {
  id: string
  task_id: string
  project_id: string
  file_name: string
  mime_type: string
  size_bytes: number
  cloudinary_url: string
  cloudinary_public_id: string
  resource_type: string
  created_by: string
  created_at: string
}

export type TaskComment = {
  id: string
  task_id: string
  comment_text: string
  mentioned_user_ids: string[]
  created_by: string
  created_by_name: string
  created_by_email: string | null
  created_at: string
  updated_at: string
  mentioned_users: TaskAssignee[]
}

export type TaskActivityLogEntry = {
  id: string
  task_id: string
  project_id: string
  event_type: string
  event_meta: Record<string, any> | null
  created_by: string
  created_by_name: string
  created_at: string
}

export type ProjectTaskDetail = ProjectTaskListItem & {
  attachments: TaskAttachment[]
  comments: TaskComment[]
  activity_log: TaskActivityLogEntry[]
}

export type TaskFilters = {
  search?: string
  status?: TaskStatus | TaskStatus[] | 'all'
  priority?: TaskPriority | TaskPriority[] | 'all'
  task_type?: TaskType | TaskType[] | 'all'
  assignee_ids?: string[]
  mine_only?: boolean
}

type ActionResult<T> = { data: T | null; error: string | null }

type CloudinaryUploadSignature = {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  folder: string
}

function isAdminManager(role?: string | null) {
  return role === 'admin' || role === 'manager'
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

  if (error) return false
  const row = data as { user_id?: string } | null
  return Boolean(row?.user_id)
}

function sanitizeDescription(html?: string | null) {
  if (!html) return null
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
}

function uniqueIds(ids: string[] = []) {
  return Array.from(new Set(ids.filter(Boolean)))
}

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

async function deleteCloudinaryAssets(
  assets: Array<{ publicId: string; resourceType: string }>
) {
  if (assets.length === 0) return
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)

  await Promise.all(
    assets.map(async (asset) => {
      const signature = signCloudinaryParams(
        { public_id: asset.publicId, timestamp },
        apiSecret
      )
      const body = new URLSearchParams({
        public_id: asset.publicId,
        timestamp: String(timestamp),
        api_key: apiKey,
        signature,
      })

      const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${asset.resourceType}/destroy`

      try {
        await fetch(endpoint, {
          method: 'POST',
          body,
        })
      } catch (error) {
        console.error('Cloudinary cleanup failed:', error)
      }
    })
  )
}

async function insertTaskActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    taskId: string
    projectId: string
    eventType: string
    eventMeta?: Record<string, any> | null
    createdBy: string
  }
) {
  await (supabase as any).from('project_task_activity_log').insert({
    task_id: input.taskId,
    project_id: input.projectId,
    event_type: input.eventType,
    event_meta: input.eventMeta ?? null,
    created_by: input.createdBy,
  })
}

async function insertNotifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
  notifications: Array<{
    user_id: string
    project_id?: string | null
    task_id?: string | null
    type: string
    title: string
    body?: string | null
    meta?: Record<string, any> | null
    created_by: string
  }>
) {
  if (notifications.length === 0) return
  await (supabase as any).from('notifications').insert(
    notifications.map((note) => ({
      user_id: note.user_id,
      project_id: note.project_id ?? null,
      task_id: note.task_id ?? null,
      type: note.type,
      title: note.title,
      body: note.body ?? null,
      meta: note.meta ?? null,
      created_by: note.created_by,
    }))
  )
}

function buildAssigneeList(rows: Array<{ user_id: string; users?: { full_name: string | null; email: string | null } | null }>) {
  return rows.map((row) => ({
    id: row.user_id,
    full_name: row.users?.full_name ?? null,
    email: row.users?.email ?? null,
  }))
}

export async function getProjectTasks(
  projectId: string,
  filters: TaskFilters = {}
): Promise<ActionResult<ProjectTaskListItem[]>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view tasks.' }
  }

  const supabase = await createClient()

  let taskIdFilter: string[] | null = null
  const assigneeIds = filters.assignee_ids ? uniqueIds(filters.assignee_ids) : []
  if (filters.mine_only && currentUser.id) {
    const { data: assignedRows } = await (supabase as any)
      .from('project_task_assignees')
      .select('task_id')
      .eq('user_id', currentUser.id)
    const ids = (assignedRows || []).map((row: { task_id: string }) => row.task_id)
    if (ids.length === 0) {
      return { data: [], error: null }
    }
    const { data: projectTaskRows } = await (supabase as any)
      .from('project_tasks')
      .select('id')
      .eq('project_id', projectId)
      .in('id', ids)
    const mineIds = (projectTaskRows || []).map((row: { id: string }) => row.id)
    if (mineIds.length === 0) {
      return { data: [], error: null }
    }
    taskIdFilter = mineIds
  } else if (assigneeIds.length > 0) {
    const { data: assignedRows } = await (supabase as any)
      .from('project_task_assignees')
      .select('task_id')
      .in('user_id', assigneeIds)
    const allTaskIds = (assignedRows || []).map((row: { task_id: string }) => row.task_id)
    if (allTaskIds.length === 0) {
      return { data: [], error: null }
    }
    const { data: projectTaskRows } = await (supabase as any)
      .from('project_tasks')
      .select('id')
      .eq('project_id', projectId)
      .in('id', allTaskIds)
    const assigneeTaskIds = (projectTaskRows || []).map((row: { id: string }) => row.id)
    if (assigneeTaskIds.length === 0) {
      return { data: [], error: null }
    }
    taskIdFilter = assigneeTaskIds
  }

  let query = (supabase as any)
    .from('project_tasks')
    .select(
      'id, project_id, title, description_html, task_type, priority, status, due_date, created_by, created_at, updated_at, in_progress_at, completed_at, actual_minutes, assignees:project_task_assignees(user_id, users!project_task_assignees_user_id_fkey(full_name, email))'
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (currentUser.role === 'client') {
    query = query.eq('status', 'completed')
  }

  if (taskIdFilter) {
    query = query.in('id', taskIdFilter)
  }

  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`)
  }

  const statusFilter = filters.status
  if (statusFilter && statusFilter !== 'all') {
    const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter]
    query = query.in('status', statuses)
  }

  const priorityFilter = filters.priority
  if (priorityFilter && priorityFilter !== 'all') {
    const priorities = Array.isArray(priorityFilter) ? priorityFilter : [priorityFilter]
    query = query.in('priority', priorities)
  }

  const typeFilter = filters.task_type
  if (typeFilter && typeFilter !== 'all') {
    const types = Array.isArray(typeFilter) ? typeFilter : [typeFilter]
    query = query.in('task_type', types)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching project tasks:', error)
    return { data: null, error: error.message || 'Failed to fetch tasks.' }
  }

  const tasks = (data || []).map((row: any) => {
    const assignees = buildAssigneeList(row.assignees || [])
    return {
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      description_html: row.description_html,
      task_type: row.task_type,
      priority: row.priority,
      status: row.status,
      due_date: row.due_date,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      in_progress_at: row.in_progress_at,
      completed_at: row.completed_at,
      actual_minutes: row.actual_minutes,
      assignees,
    } as ProjectTaskListItem
  })

  return { data: tasks, error: null }
}

export async function getProjectTaskDetail(taskId: string): Promise<ActionResult<ProjectTaskDetail>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view this task.' }
  }

  const supabase = await createClient()
  type TaskRow = {
    id: string
    project_id: string
    title: string
    description_html: string | null
    task_type: string | null
    priority: string | null
    status: string
    due_date: string | null
    created_by: string
    created_at: string
    updated_at: string
    in_progress_at: string | null
    completed_at: string | null
    actual_minutes: number | null
  }
  const { data: taskData, error: taskError } = await (supabase as any)
    .from('project_tasks')
    .select('*')
    .eq('id', taskId)
    .single()
  const task = taskData as TaskRow | null

  if (taskError || !task) {
    console.error('Error fetching task detail:', taskError)
    return { data: null, error: taskError?.message || 'Task not found.' }
  }

  const { data: assigneeRows } = await (supabase as any)
    .from('project_task_assignees')
    .select('user_id, users!project_task_assignees_user_id_fkey(full_name, email)')
    .eq('task_id', taskId)

  const { data: attachments } = await (supabase as any)
    .from('project_task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })

  const { data: comments } = await (supabase as any)
    .from('project_task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  const { data: activity } = await (supabase as any)
    .from('project_task_activity_log')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })

  const commentList = (comments as any[]) || []
  const activityList = (activity as any[]) || []

  const mentionIds = commentList.flatMap((comment) => comment.mentioned_user_ids || [])
  const userIds = uniqueIds([
    ...commentList.map((comment) => comment.created_by),
    ...activityList.map((entry) => entry.created_by),
    ...mentionIds,
  ])

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email')
    .in('id', userIds)

  const userNameMap = new Map<string, string>()
  const userEmailMap = new Map<string, string | null>()
  ;(users as Array<{ id: string; full_name: string | null; email: string | null }> | null)?.forEach(
    (user) => {
      userNameMap.set(user.id, user.full_name || 'Unknown User')
      userEmailMap.set(user.id, user.email)
    }
  )

  const mappedComments: TaskComment[] = commentList.map((comment) => {
    const mentioned = (comment.mentioned_user_ids || []).map((id: string) => ({
      id,
      full_name: userNameMap.get(id) || 'Unknown User',
      email: userEmailMap.get(id) || null,
    }))
    return {
      id: comment.id,
      task_id: comment.task_id,
      comment_text: comment.comment_text,
      mentioned_user_ids: comment.mentioned_user_ids || [],
      created_by: comment.created_by,
      created_by_name: userNameMap.get(comment.created_by) || 'Unknown User',
      created_by_email: userEmailMap.get(comment.created_by) || null,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      mentioned_users: mentioned,
    }
  })

  const mappedActivity: TaskActivityLogEntry[] = activityList.map((entry) => ({
    id: entry.id,
    task_id: entry.task_id,
    project_id: entry.project_id,
    event_type: entry.event_type,
    event_meta: entry.event_meta ?? null,
    created_by: entry.created_by,
    created_by_name: userNameMap.get(entry.created_by) || 'Unknown User',
    created_at: entry.created_at,
  }))

  const taskDetail: ProjectTaskDetail = {
    id: task.id,
    project_id: task.project_id,
    title: task.title,
    description_html: task.description_html,
    task_type: task.task_type as TaskType | null,
    priority: task.priority as TaskPriority | null,
    status: task.status as TaskStatus,
    due_date: task.due_date,
    created_by: task.created_by,
    created_at: task.created_at,
    updated_at: task.updated_at,
    in_progress_at: task.in_progress_at,
    completed_at: task.completed_at,
    actual_minutes: task.actual_minutes,
    assignees: buildAssigneeList((assigneeRows as any[]) || []),
    attachments: (attachments as TaskAttachment[]) || [],
    comments: mappedComments,
    activity_log: mappedActivity,
  }

  return { data: taskDetail, error: null }
}

export async function getTaskMentionableUsers(): Promise<ActionResult<TaskAssignee[]>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view users.' }
  }

  const supabase = await createClient()
  const { data, error } = await (supabase
    .from('users')
    .select('id, full_name, email, role, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true }) as any)

  if (error) {
    console.error('Error fetching mentionable users:', error)
    return { data: null, error: error.message || 'Failed to fetch users.' }
  }

  const users = (data || []) as Array<{ id: string; full_name: string | null; email: string | null }>
  return {
    data: users.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
    })),
    error: null,
  }
}

export async function createProjectTask(
  projectId: string,
  payload: {
    title: string
    description_html?: string | null
    task_type?: TaskType | null
    priority?: TaskPriority | null
    status?: TaskStatus | null
    due_date?: string | null
    assignee_ids?: string[]
  }
): Promise<ActionResult<ProjectTaskListItem>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to create tasks.' }
  }

  if (!isAdminManager(currentUser.role)) {
    return { data: null, error: 'Only admins and managers can create tasks.' }
  }

  const title = payload.title?.trim()
  if (!title) {
    return { data: null, error: 'Task title is required.' }
  }

  const supabase = await createClient()

  const { data: task, error } = await (supabase as any)
    .from('project_tasks')
    .insert({
      project_id: projectId,
      title,
      description_html: sanitizeDescription(payload.description_html),
      task_type: payload.task_type ?? null,
      priority: payload.priority ?? null,
      status: payload.status ?? 'todo',
      due_date: payload.due_date ?? null,
      created_by: currentUser.id,
      updated_by: currentUser.id,
    })
    .select('*')
    .single()

  if (error || !task) {
    console.error('Error creating task:', error)
    return { data: null, error: error?.message || 'Failed to create task.' }
  }

  const assigneeIds = uniqueIds(payload.assignee_ids)
  if (assigneeIds.length > 0) {
    const assignments = assigneeIds.map((userId) => ({
      task_id: task.id,
      user_id: userId,
      assigned_by: currentUser.id,
    }))
    const { error: assignError } = await (supabase as any).from('project_task_assignees').insert(assignments)
    if (assignError) {
      console.error('Error assigning task:', assignError)
    }

    await insertNotifications(
      supabase,
      assigneeIds
        .filter((id) => id !== currentUser.id)
        .map((id) => ({
          user_id: id,
          project_id: projectId,
          task_id: task.id,
          type: 'task_assigned',
          title: 'New task assigned',
          body: title,
          meta: { task_title: title },
          created_by: currentUser.id,
        }))
    )
  }

  await insertTaskActivity(supabase, {
    taskId: task.id,
    projectId,
    eventType: 'task_created',
    eventMeta: { title },
    createdBy: currentUser.id,
  })

  if (assigneeIds.length > 0) {
    await insertTaskActivity(supabase, {
      taskId: task.id,
      projectId,
      eventType: 'assignees_updated',
      eventMeta: { assignees: assigneeIds },
      createdBy: currentUser.id,
    })
  }

  const { data: assignees } = await (supabase as any)
    .from('project_task_assignees')
    .select('user_id, users!project_task_assignees_user_id_fkey(full_name, email)')
    .eq('task_id', task.id)

  revalidatePath(`/dashboard/projects/${projectId}`)

  return {
    data: {
      id: task.id,
      project_id: task.project_id,
      title: task.title,
      description_html: task.description_html,
      task_type: task.task_type,
      priority: task.priority,
      status: task.status,
      due_date: task.due_date,
      created_by: task.created_by,
      created_at: task.created_at,
      updated_at: task.updated_at,
      in_progress_at: task.in_progress_at,
      completed_at: task.completed_at,
      actual_minutes: task.actual_minutes,
      assignees: buildAssigneeList((assignees as any[]) || []),
    },
    error: null,
  }
}

export async function updateProjectTask(
  taskId: string,
  payload: {
    title?: string
    description_html?: string | null
    task_type?: TaskType | null
    priority?: TaskPriority | null
    status?: TaskStatus | null
    due_date?: string | null
  }
): Promise<ActionResult<ProjectTaskListItem>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update tasks.' }
  }

  if (!isAdminManager(currentUser.role)) {
    return { data: null, error: 'Only admins and managers can update tasks.' }
  }

  const supabase = await createClient()
  const { data: existing, error: existingError } = await (supabase as any)
    .from('project_tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (existingError || !existing) {
    return { data: null, error: existingError?.message || 'Task not found.' }
  }

  const updateData: Record<string, any> = {
    updated_by: currentUser.id,
  }

  if (payload.title !== undefined) updateData.title = payload.title.trim()
  if (payload.description_html !== undefined)
    updateData.description_html = sanitizeDescription(payload.description_html)
  if (payload.task_type !== undefined) updateData.task_type = payload.task_type
  if (payload.priority !== undefined) updateData.priority = payload.priority
  if (payload.status !== undefined) updateData.status = payload.status
  if (payload.due_date !== undefined) updateData.due_date = payload.due_date

  const { data: task, error } = await (supabase as any)
    .from('project_tasks')
    .update(updateData)
    .eq('id', taskId)
    .select('*')
    .single()

  if (error || !task) {
    console.error('Error updating task:', error)
    return { data: null, error: error?.message || 'Failed to update task.' }
  }

  const changedFields = Object.keys(updateData).filter((field) => field !== 'updated_by')
  if (changedFields.length > 0) {
    await insertTaskActivity(supabase, {
      taskId: task.id,
      projectId: task.project_id,
      eventType: 'task_updated',
      eventMeta: { fields: changedFields },
      createdBy: currentUser.id,
    })
  }

  const { data: assignees } = await (supabase as any)
    .from('project_task_assignees')
    .select('user_id, users!project_task_assignees_user_id_fkey(full_name, email)')
    .eq('task_id', task.id)

  revalidatePath(`/dashboard/projects/${task.project_id}`)

  return {
    data: {
      id: task.id,
      project_id: task.project_id,
      title: task.title,
      description_html: task.description_html,
      task_type: task.task_type,
      priority: task.priority,
      status: task.status,
      due_date: task.due_date,
      created_by: task.created_by,
      created_at: task.created_at,
      updated_at: task.updated_at,
      in_progress_at: task.in_progress_at,
      completed_at: task.completed_at,
      actual_minutes: task.actual_minutes,
      assignees: buildAssigneeList((assignees as any[]) || []),
    },
    error: null,
  }
}

export async function updateTaskAssignees(
  taskId: string,
  assigneeIds: string[]
): Promise<ActionResult<ProjectTaskListItem>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update assignees.' }
  }

  if (!isAdminManager(currentUser.role)) {
    return { data: null, error: 'Only admins and managers can update assignees.' }
  }

  const supabase = await createClient()
  const { data: task } = await (supabase as any)
    .from('project_tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (!task) {
    return { data: null, error: 'Task not found.' }
  }

  const uniqueAssignees = uniqueIds(assigneeIds)

  const { data: existingRows } = await (supabase as any)
    .from('project_task_assignees')
    .select('user_id')
    .eq('task_id', taskId)

  const existingIds = new Set((existingRows || []).map((row: any) => row.user_id))
  const nextIds = new Set(uniqueAssignees)

  const toInsert = uniqueAssignees.filter((id) => !existingIds.has(id))
  const toDelete = (Array.from(existingIds) as string[]).filter((id) => !nextIds.has(id))

  if (toInsert.length > 0) {
    await (supabase as any).from('project_task_assignees').insert(
      toInsert.map((id) => ({
        task_id: taskId,
        user_id: id,
        assigned_by: currentUser.id,
      }))
    )

    await insertNotifications(
      supabase,
      toInsert
        .filter((id) => id !== currentUser.id)
        .map((id) => ({
          user_id: id,
          project_id: task.project_id,
          task_id: taskId,
          type: 'task_assigned',
          title: 'New task assigned',
          body: task.title,
          meta: { task_title: task.title },
          created_by: currentUser.id,
        }))
    )
  }

  if (toDelete.length > 0) {
    await (supabase as any)
      .from('project_task_assignees')
      .delete()
      .eq('task_id', taskId)
      .in('user_id', toDelete)
  }

  await insertTaskActivity(supabase, {
    taskId,
    projectId: task.project_id,
    eventType: 'assignees_updated',
    eventMeta: { assignees: uniqueAssignees },
    createdBy: currentUser.id,
  })

  const { data: assignees } = await (supabase as any)
    .from('project_task_assignees')
    .select('user_id, users!project_task_assignees_user_id_fkey(full_name, email)')
    .eq('task_id', taskId)

  revalidatePath(`/dashboard/projects/${task.project_id}`)

  return {
    data: {
      id: task.id,
      project_id: task.project_id,
      title: task.title,
      description_html: task.description_html,
      task_type: task.task_type,
      priority: task.priority,
      status: task.status,
      due_date: task.due_date,
      created_by: task.created_by,
      created_at: task.created_at,
      updated_at: task.updated_at,
      in_progress_at: task.in_progress_at,
      completed_at: task.completed_at,
      actual_minutes: task.actual_minutes,
      assignees: buildAssigneeList((assignees as any[]) || []),
    },
    error: null,
  }
}

export async function updateTaskStatus(
  taskId: string,
  nextStatus: TaskStatus
): Promise<ActionResult<ProjectTaskListItem>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update task status.' }
  }

  const supabase = await createClient()
  const { data: task, error } = await (supabase as any)
    .from('project_tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (error || !task) {
    return { data: null, error: error?.message || 'Task not found.' }
  }

  const canWriteProjects = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  const canManage = isAdminManager(currentUser.role) || canWriteProjects

  if (!canManage && currentUser.role === 'staff') {
    const isAssigned = await isUserAssignedToProject(supabase, task.project_id, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to update this task.' }
    }
  }

  if (!TASK_STATUSES.includes(nextStatus)) {
    return { data: null, error: 'Invalid status.' }
  }

  const now = new Date()
  let inProgressAt = task.in_progress_at
  let completedAt = task.completed_at
  let actualMinutes = task.actual_minutes

  if (nextStatus === 'in_progress') {
    inProgressAt = now.toISOString()
    completedAt = null
    actualMinutes = null
  }

  if (nextStatus === 'done' || nextStatus === 'completed') {
    const start = inProgressAt ? new Date(inProgressAt) : null
    if (start) {
      const diffMs = now.getTime() - start.getTime()
      actualMinutes = Math.max(0, Math.round(diffMs / 60000))
    } else {
      actualMinutes = 0
    }
    completedAt = now.toISOString()
  }

  if (nextStatus !== 'done' && nextStatus !== 'completed') {
    completedAt = null
    actualMinutes = null
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from('project_tasks')
    .update({
      status: nextStatus,
      in_progress_at: inProgressAt,
      completed_at: completedAt,
      actual_minutes: actualMinutes,
      updated_by: currentUser.id,
    })
    .eq('id', taskId)
    .select('*')
    .single()

  if (updateError || !updated) {
    console.error('Error updating task status:', updateError)
    return { data: null, error: updateError?.message || 'Failed to update status.' }
  }

  await insertTaskActivity(supabase, {
    taskId: updated.id,
    projectId: updated.project_id,
    eventType: 'status_changed',
    eventMeta: { from: task.status, to: nextStatus },
    createdBy: currentUser.id,
  })

  if (nextStatus === 'done' || nextStatus === 'completed') {
    const { data: assignees } = await (supabase as any)
      .from('project_task_assignees')
      .select('user_id')
      .eq('task_id', updated.id)

    const assigneeIds = (assignees || []).map((row: any) => row.user_id) as string[]
    await insertNotifications(
      supabase,
      assigneeIds
        .filter((id) => id !== currentUser.id)
        .map((id) => ({
          user_id: id,
          project_id: updated.project_id,
          task_id: updated.id,
          type: 'task_completed',
          title: 'Task marked complete',
          body: updated.title,
          meta: { status: nextStatus },
          created_by: currentUser.id,
        }))
    )
  }

  const { data: assignees } = await supabase
    .from('project_task_assignees')
    .select('user_id, users!project_task_assignees_user_id_fkey(full_name, email)')
    .eq('task_id', updated.id)

  revalidatePath(`/dashboard/projects/${updated.project_id}`)

  return {
    data: {
      id: updated.id,
      project_id: updated.project_id,
      title: updated.title,
      description_html: updated.description_html,
      task_type: updated.task_type,
      priority: updated.priority,
      status: updated.status,
      due_date: updated.due_date,
      created_by: updated.created_by,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      in_progress_at: updated.in_progress_at,
      completed_at: updated.completed_at,
      actual_minutes: updated.actual_minutes,
      assignees: buildAssigneeList((assignees as any[]) || []),
    },
    error: null,
  }
}

export async function deleteProjectTask(taskId: string): Promise<ActionResult<{ projectId: string }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to delete tasks.' }
  }

  if (!isAdminManager(currentUser.role)) {
    return { data: null, error: 'Only admins and managers can delete tasks.' }
  }

  const supabase = await createClient()
  const { data: task } = await (supabase as any)
    .from('project_tasks')
    .select('project_id')
    .eq('id', taskId)
    .single()

  if (!task) {
    return { data: null, error: 'Task not found.' }
  }

  const { error } = await (supabase as any).from('project_tasks').delete().eq('id', taskId)
  if (error) {
    return { data: null, error: error.message || 'Failed to delete task.' }
  }

  revalidatePath(`/dashboard/projects/${task.project_id}`)
  return { data: { projectId: task.project_id }, error: null }
}

export async function createTaskComment(
  taskId: string,
  commentText: string,
  mentionIds: string[] = []
): Promise<ActionResult<TaskComment>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to add comments.' }
  }

  if (currentUser.role === 'client') {
    return { data: null, error: 'Clients cannot add comments.' }
  }

  const trimmed = commentText.trim()
  if (!trimmed) {
    return { data: null, error: 'Comment cannot be empty.' }
  }

  const supabase = await createClient()
  const { data: task } = await (supabase as any)
    .from('project_tasks')
    .select('project_id')
    .eq('id', taskId)
    .single()

  if (!task) {
    return { data: null, error: 'Task not found.' }
  }

  if (currentUser.role === 'staff') {
    const assigned = await isUserAssignedToProject(supabase, task.project_id, currentUser.id)
    if (!assigned) {
      return { data: null, error: 'You do not have permission to comment on this task.' }
    }
  }

  const mentionList = uniqueIds(mentionIds)

  const { data: comment, error } = await (supabase as any)
    .from('project_task_comments')
    .insert({
      task_id: taskId,
      comment_text: trimmed,
      mentioned_user_ids: mentionList,
      created_by: currentUser.id,
    })
    .select('*')
    .single()

  if (error || !comment) {
    console.error('Error creating comment:', error)
    return { data: null, error: error?.message || 'Failed to add comment.' }
  }

  await insertTaskActivity(supabase, {
    taskId,
    projectId: task.project_id,
    eventType: 'comment_added',
    eventMeta: { mentioned_user_ids: mentionList },
    createdBy: currentUser.id,
  })

  if (mentionList.length > 0) {
    await insertNotifications(
      supabase,
      mentionList
        .filter((id) => id !== currentUser.id)
        .map((id) => ({
          user_id: id,
          project_id: task.project_id,
          task_id: taskId,
          type: 'task_mention',
          title: 'You were mentioned',
          body: trimmed.slice(0, 120),
          meta: { comment_id: comment.id },
          created_by: currentUser.id,
        }))
    )
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email')
    .in('id', uniqueIds([comment.created_by, ...mentionList]))

  const userNameMap = new Map<string, string>()
  const userEmailMap = new Map<string, string | null>()
  ;(users as Array<{ id: string; full_name: string | null; email: string | null }> | null)?.forEach(
    (user) => {
      userNameMap.set(user.id, user.full_name || 'Unknown User')
      userEmailMap.set(user.id, user.email)
    }
  )

  return {
    data: {
      id: comment.id,
      task_id: comment.task_id,
      comment_text: comment.comment_text,
      mentioned_user_ids: comment.mentioned_user_ids || [],
      created_by: comment.created_by,
      created_by_name: userNameMap.get(comment.created_by) || 'Unknown User',
      created_by_email: userEmailMap.get(comment.created_by) || null,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      mentioned_users: mentionList.map((id) => ({
        id,
        full_name: userNameMap.get(id) || 'Unknown User',
        email: userEmailMap.get(id) || null,
      })),
    },
    error: null,
  }
}

export async function updateTaskComment(
  commentId: string,
  commentText: string,
  mentionIds: string[] = []
): Promise<ActionResult<TaskComment>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update comments.' }
  }

  const supabase = await createClient()
  const { data: existing } = await (supabase as any)
    .from('project_task_comments')
    .select('task_id, created_by')
    .eq('id', commentId)
    .single()

  if (!existing) {
    return { data: null, error: 'Comment not found.' }
  }

  const canManage = isAdminManager(currentUser.role)
  if (!canManage && existing.created_by !== currentUser.id) {
    return { data: null, error: 'You can only edit your own comments.' }
  }

  const trimmed = commentText.trim()
  if (!trimmed) {
    return { data: null, error: 'Comment cannot be empty.' }
  }

  const mentionList = uniqueIds(mentionIds)

  const { data: comment, error } = await (supabase as any)
    .from('project_task_comments')
    .update({ comment_text: trimmed, mentioned_user_ids: mentionList })
    .eq('id', commentId)
    .select('*')
    .single()

  if (error || !comment) {
    console.error('Error updating comment:', error)
    return { data: null, error: error?.message || 'Failed to update comment.' }
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email')
    .in('id', uniqueIds([comment.created_by, ...mentionList]))

  const userNameMap = new Map<string, string>()
  const userEmailMap = new Map<string, string | null>()
  ;(users as Array<{ id: string; full_name: string | null; email: string | null }> | null)?.forEach(
    (user) => {
      userNameMap.set(user.id, user.full_name || 'Unknown User')
      userEmailMap.set(user.id, user.email)
    }
  )

  return {
    data: {
      id: comment.id,
      task_id: comment.task_id,
      comment_text: comment.comment_text,
      mentioned_user_ids: comment.mentioned_user_ids || [],
      created_by: comment.created_by,
      created_by_name: userNameMap.get(comment.created_by) || 'Unknown User',
      created_by_email: userEmailMap.get(comment.created_by) || null,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      mentioned_users: mentionList.map((id) => ({
        id,
        full_name: userNameMap.get(id) || 'Unknown User',
        email: userEmailMap.get(id) || null,
      })),
    },
    error: null,
  }
}

export async function deleteTaskComment(commentId: string): Promise<ActionResult<{ taskId: string }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to delete comments.' }
  }

  const supabase = await createClient()
  const { data: existing } = await (supabase as any)
    .from('project_task_comments')
    .select('task_id, created_by')
    .eq('id', commentId)
    .single()

  if (!existing) {
    return { data: null, error: 'Comment not found.' }
  }

  const canManage = isAdminManager(currentUser.role)
  if (!canManage && existing.created_by !== currentUser.id) {
    return { data: null, error: 'You can only delete your own comments.' }
  }

  const { error } = await (supabase as any).from('project_task_comments').delete().eq('id', commentId)
  if (error) {
    return { data: null, error: error.message || 'Failed to delete comment.' }
  }

  return { data: { taskId: existing.task_id }, error: null }
}

export async function getTaskUploadSignature(
  projectId: string
): Promise<ActionResult<CloudinaryUploadSignature>> {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdminManager(currentUser.role)) {
    return { data: null, error: 'You do not have permission to upload attachments.' }
  }

  const supabase = await createClient()
  const canAccess = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'read')
  if (!canAccess && !(await isUserAssignedToProject(supabase, projectId, currentUser.id))) {
    return { data: null, error: 'You do not have access to this project.' }
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const folder = TASK_CLOUDINARY_FOLDER
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

export async function createTaskAttachments(
  taskId: string,
  attachments: Array<{
    file_name: string
    mime_type: string
    size_bytes: number
    cloudinary_url: string
    cloudinary_public_id: string
    resource_type: string
  }>
): Promise<ActionResult<TaskAttachment[]>> {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdminManager(currentUser.role)) {
    return { data: null, error: 'You do not have permission to upload attachments.' }
  }

  const supabase = await createClient()
  const { data: task } = await (supabase as any)
    .from('project_tasks')
    .select('project_id, title')
    .eq('id', taskId)
    .single()

  if (!task) {
    return { data: null, error: 'Task not found.' }
  }

  for (const attachment of attachments) {
    if (attachment.size_bytes > TASK_MAX_ATTACHMENT_SIZE_BYTES) {
      return { data: null, error: 'Attachment exceeds the 5MB limit.' }
    }
    if (!TASK_ALLOWED_MIME_TYPES.includes(attachment.mime_type as any)) {
      return { data: null, error: 'Attachment type not allowed.' }
    }
  }

  const { data: created, error } = await (supabase as any)
    .from('project_task_attachments')
    .insert(
      attachments.map((att) => ({
        task_id: taskId,
        project_id: task.project_id,
        file_name: att.file_name,
        mime_type: att.mime_type,
        size_bytes: att.size_bytes,
        cloudinary_url: att.cloudinary_url,
        cloudinary_public_id: att.cloudinary_public_id,
        resource_type: att.resource_type,
        created_by: currentUser.id,
      }))
    )
    .select('*')

  if (error) {
    console.error('Error saving attachments:', error)
    return { data: null, error: error.message || 'Failed to save attachments.' }
  }

  await insertTaskActivity(supabase, {
    taskId,
    projectId: task.project_id,
    eventType: 'attachment_added',
    eventMeta: { count: attachments.length },
    createdBy: currentUser.id,
  })

  revalidatePath(`/dashboard/projects/${task.project_id}`)
  return { data: (created as TaskAttachment[]) || [], error: null }
}

export async function deleteTaskAttachment(attachmentId: string): Promise<ActionResult<{ taskId: string }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdminManager(currentUser.role)) {
    return { data: null, error: 'You do not have permission to delete attachments.' }
  }

  const supabase = await createClient()
  const { data: attachment } = await (supabase as any)
    .from('project_task_attachments')
    .select('task_id, project_id, cloudinary_public_id, resource_type')
    .eq('id', attachmentId)
    .single()

  if (!attachment) {
    return { data: null, error: 'Attachment not found.' }
  }

  const { error } = await (supabase as any).from('project_task_attachments').delete().eq('id', attachmentId)
  if (error) {
    return { data: null, error: error.message || 'Failed to delete attachment.' }
  }

  await deleteCloudinaryAssets([
    { publicId: attachment.cloudinary_public_id, resourceType: attachment.resource_type },
  ])

  await insertTaskActivity(supabase, {
    taskId: attachment.task_id,
    projectId: attachment.project_id,
    eventType: 'attachment_removed',
    eventMeta: { attachment_id: attachmentId },
    createdBy: currentUser.id,
  })

  revalidatePath(`/dashboard/projects/${attachment.project_id}`)
  return { data: { taskId: attachment.task_id }, error: null }
}
