'use server'

import { after } from 'next/server'
import { cache } from 'react'
import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import {
  TASK_STATUSES,
  TASK_ALLOWED_MIME_TYPES,
  TASK_CLOUDINARY_FOLDER,
  TASK_COMMENT_REACTION_EMOJIS,
  TASK_MAX_ATTACHMENT_SIZE_BYTES,
  TASK_DETAIL_COMMENTS_LIMIT,
  TASK_DETAIL_ACTIVITY_LIMIT,
  TASK_DETAIL_ATTACHMENTS_LIMIT,
  type TaskStatus,
  type TaskPriority,
  type TaskType,
} from './tasks-constants'

export type TaskAssignee = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  photo_url?: string | null
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

export type TaskCommentAttachment = {
  id: string
  comment_id: string
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

export type TaskCommentAttachmentInput = {
  file_name: string
  mime_type: string
  size_bytes: number
  cloudinary_url: string
  cloudinary_public_id: string
  resource_type: string
}

export type TaskCommentReactionUser = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

export type TaskCommentReaction = {
  emoji: string
  count: number
  reacted_by_current_user: boolean
  users: TaskCommentReactionUser[]
}

export type TaskComment = {
  id: string
  task_id: string
  comment_text: string
  mentioned_user_ids: string[]
  created_by: string
  created_by_name: string
  created_by_email: string | null
  created_by_role: string | null
  created_at: string
  updated_at: string
  mentioned_users: TaskAssignee[]
  attachments: TaskCommentAttachment[]
  reactions: TaskCommentReaction[]
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
  /** Total counts for pagination (load more) */
  commentsTotalCount: number
  activityTotalCount: number
  attachmentsTotalCount: number
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

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

async function getTaskPermissionFlags(currentUser: AuthenticatedUser) {
  const [canWriteProjects, canWriteProjectTasks, canReadProjectTasks] = await Promise.all([
    hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write'),
    hasPermission(currentUser, MODULE_PERMISSION_IDS.projectTasks, 'write'),
    hasPermission(currentUser, MODULE_PERMISSION_IDS.projectTasks, 'read'),
  ])

  return {
    canWriteProjects,
    canWriteProjectTasks,
    canReadProjectTasks,
  }
}

function canManageTasksWithWriteAccess(
  currentUser: Pick<AuthenticatedUser, 'role'>,
  flags: Pick<Awaited<ReturnType<typeof getTaskPermissionFlags>>, 'canWriteProjects' | 'canWriteProjectTasks'>
) {
  return isAdminManager(currentUser.role) || flags.canWriteProjects || flags.canWriteProjectTasks
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

function normalizeTaskCommentReactionEmoji(emoji: string) {
  return emoji.trim()
}

function isTaskCommentReactionEmojiSupported(emoji: string) {
  return TASK_COMMENT_REACTION_EMOJIS.includes(emoji as (typeof TASK_COMMENT_REACTION_EMOJIS)[number])
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

function buildAssigneeList(rows: Array<{ user_id: string; users?: { full_name: string | null; email: string | null; role: string | null; photo_url?: string | null } | null }>) {
  return rows.map((row) => ({
    id: row.user_id,
    full_name: row.users?.full_name ?? null,
    email: row.users?.email ?? null,
    role: row.users?.role ?? null,
    photo_url: row.users?.photo_url ?? null,
  }))
}

function buildTaskUserMaps(
  users: Array<{ id: string; full_name: string | null; email: string | null; role: string | null }> | null
) {
  const userNameMap = new Map<string, string>()
  const userEmailMap = new Map<string, string | null>()
  const userRoleMap = new Map<string, string | null>()

  ;(users || []).forEach((user) => {
    userNameMap.set(user.id, user.full_name || 'Unknown User')
    userEmailMap.set(user.id, user.email)
    userRoleMap.set(user.id, user.role ?? null)
  })

  return { userNameMap, userEmailMap, userRoleMap }
}

type TaskCommentReactionRow = {
  comment_id: string
  emoji: string
  created_by: string
  created_at: string
}

const TASK_COMMENT_REACTION_ORDER = new Map<string, number>(
  TASK_COMMENT_REACTION_EMOJIS.map((emoji, index) => [emoji, index])
)

async function getTaskCommentReactionRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  commentIds: string[]
): Promise<TaskCommentReactionRow[]> {
  if (commentIds.length === 0) return []

  const { data } = await (supabase as any)
    .from('project_task_comment_reactions')
    .select('comment_id, emoji, created_by, created_at')
    .in('comment_id', commentIds)
    .order('created_at', { ascending: true })

  return (data as TaskCommentReactionRow[] | null) || []
}

function buildTaskCommentReactionMap(
  reactions: TaskCommentReactionRow[],
  maps: {
    userNameMap: Map<string, string>
    userEmailMap: Map<string, string | null>
    userRoleMap: Map<string, string | null>
  },
  currentUserId: string
) {
  const reactionsByComment = new Map<string, Map<string, TaskCommentReaction>>()

  reactions.forEach((reaction) => {
    let groupedReactions = reactionsByComment.get(reaction.comment_id)
    if (!groupedReactions) {
      groupedReactions = new Map<string, TaskCommentReaction>()
      reactionsByComment.set(reaction.comment_id, groupedReactions)
    }

    const existing = groupedReactions.get(reaction.emoji)
    const reactionUser: TaskCommentReactionUser = {
      id: reaction.created_by,
      full_name: maps.userNameMap.get(reaction.created_by) ?? 'Unknown User',
      email: maps.userEmailMap.get(reaction.created_by) ?? null,
      role: maps.userRoleMap.get(reaction.created_by) ?? null,
    }

    if (existing) {
      existing.count += 1
      existing.users.push(reactionUser)
      existing.reacted_by_current_user = existing.reacted_by_current_user || reaction.created_by === currentUserId
      return
    }

    groupedReactions.set(reaction.emoji, {
      emoji: reaction.emoji,
      count: 1,
      reacted_by_current_user: reaction.created_by === currentUserId,
      users: [reactionUser],
    })
  })

  const mapped = new Map<string, TaskCommentReaction[]>()
  reactionsByComment.forEach((groupedReactions, commentId) => {
    const sorted = Array.from(groupedReactions.values()).sort((a, b) => {
      const aIndex = TASK_COMMENT_REACTION_ORDER.get(a.emoji) ?? Number.MAX_SAFE_INTEGER
      const bIndex = TASK_COMMENT_REACTION_ORDER.get(b.emoji) ?? Number.MAX_SAFE_INTEGER
      if (aIndex !== bIndex) return aIndex - bIndex
      return a.emoji.localeCompare(b.emoji)
    })
    mapped.set(commentId, sorted)
  })

  return mapped
}

function mapTaskComment(
  comment: {
    id: string
    task_id: string
    comment_text: string
    mentioned_user_ids: string[] | null
    created_by: string
    created_at: string
    updated_at: string
  },
  maps: {
    userNameMap: Map<string, string>
    userEmailMap: Map<string, string | null>
    userRoleMap: Map<string, string | null>
  },
  attachmentsByComment: Map<string, TaskCommentAttachment[]>,
  reactionsByComment: Map<string, TaskCommentReaction[]>
): TaskComment {
  const mentionList = comment.mentioned_user_ids || []
  const mentionedUsers = mentionList.map((id) => ({
    id,
    full_name: maps.userNameMap.get(id) || 'Unknown User',
    email: maps.userEmailMap.get(id) || null,
    role: maps.userRoleMap.get(id) || null,
  }))

  return {
    id: comment.id,
    task_id: comment.task_id,
    comment_text: comment.comment_text,
    mentioned_user_ids: mentionList,
    created_by: comment.created_by,
    created_by_name: maps.userNameMap.get(comment.created_by) || 'Unknown User',
    created_by_email: maps.userEmailMap.get(comment.created_by) || null,
    created_by_role: maps.userRoleMap.get(comment.created_by) || null,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    mentioned_users: mentionedUsers,
    attachments: attachmentsByComment.get(comment.id) || [],
    reactions: reactionsByComment.get(comment.id) || [],
  }
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

  // Optimize: Get task IDs for assignee filters using a more efficient approach
  let taskIdFilter: string[] | null = null
  const assigneeIds = filters.assignee_ids ? uniqueIds(filters.assignee_ids) : []
  
  if (filters.mine_only && currentUser.id) {
    // Get all task IDs assigned to current user, then filter by project in one query
    const { data: assignedRows } = await (supabase as any)
      .from('project_task_assignees')
      .select('task_id')
      .eq('user_id', currentUser.id)
    
    if (!assignedRows || assignedRows.length === 0) {
      return { data: [], error: null }
    }
    
    const allTaskIds = assignedRows.map((row: { task_id: string }) => row.task_id)
    // Filter by project in a single query
    const { data: projectTaskRows } = await (supabase as any)
      .from('project_tasks')
      .select('id')
      .eq('project_id', projectId)
      .in('id', allTaskIds)
    
    if (!projectTaskRows || projectTaskRows.length === 0) {
      return { data: [], error: null }
    }
    taskIdFilter = projectTaskRows.map((row: { id: string }) => row.id)
  } else if (assigneeIds.length > 0) {
    // Get all task IDs for specified assignees, then filter by project
    const { data: assignedRows } = await (supabase as any)
      .from('project_task_assignees')
      .select('task_id')
      .in('user_id', assigneeIds)
    
    if (!assignedRows || assignedRows.length === 0) {
      return { data: [], error: null }
    }
    
    // Deduplicate task IDs
    const allTaskIds = Array.from(new Set(assignedRows.map((row: { task_id: string }) => row.task_id)))
    // Filter by project in a single query
    const { data: projectTaskRows } = await (supabase as any)
      .from('project_tasks')
      .select('id')
      .eq('project_id', projectId)
      .in('id', allTaskIds)
    
    if (!projectTaskRows || projectTaskRows.length === 0) {
      return { data: [], error: null }
    }
    taskIdFilter = projectTaskRows.map((row: { id: string }) => row.id)
  }

  // Build main query - removed description_html from list query for better performance
  let query = (supabase as any)
    .from('project_tasks')
    .select(
      // Removed description_html - only load it in detail view to reduce data transfer and improve performance
      'id, project_id, title, task_type, priority, status, due_date, created_by, created_at, updated_at, in_progress_at, completed_at, actual_minutes, assignees:project_task_assignees(user_id, users!project_task_assignees_user_id_fkey(full_name, email, role, photo_url))'
    )
    .eq('project_id', projectId)

  if (taskIdFilter) {
    query = query.in('id', taskIdFilter)
  }

  if (currentUser.role === 'client') {
    query = query.eq('status', 'completed')
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

  // Add limit to prevent loading too many tasks at once (500 is reasonable for most use cases)
  query = query.order('created_at', { ascending: false }).limit(500)

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
      description_html: null, // Not loaded in list view for performance
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

/** Request-scoped cache: deduplicates getProjectTaskDetail calls for the same taskId within a request */
export const getProjectTaskDetail = cache(async (taskId: string): Promise<ActionResult<ProjectTaskDetail>> => {
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
  // Batch 1: Run task, assignees, attachments, comments, activity in parallel
  const [taskRes, assigneesRes, attachmentsRes, commentsRes, activityRes] = await Promise.all([
    (supabase as any)
      .from('project_tasks')
      .select('id, project_id, title, description_html, task_type, priority, status, due_date, created_by, created_at, updated_at, in_progress_at, completed_at, actual_minutes')
      .eq('id', taskId)
      .single(),
    (supabase as any)
      .from('project_task_assignees')
      .select('user_id, users!project_task_assignees_user_id_fkey(full_name, email, role, photo_url)')
      .eq('task_id', taskId),
    (supabase as any)
      .from('project_task_attachments')
      .select('id, task_id, project_id, file_name, mime_type, size_bytes, cloudinary_url, cloudinary_public_id, resource_type, created_by, created_at', { count: 'exact' })
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .range(0, TASK_DETAIL_ATTACHMENTS_LIMIT - 1),
    (supabase as any)
      .from('project_task_comments')
      .select('id, task_id, comment_text, mentioned_user_ids, created_by, created_at, updated_at', { count: 'exact' })
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .range(0, TASK_DETAIL_COMMENTS_LIMIT - 1),
    (supabase as any)
      .from('project_task_activity_log')
      .select('id, task_id, project_id, event_type, event_meta, created_by, created_at', { count: 'exact' })
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .range(0, TASK_DETAIL_ACTIVITY_LIMIT - 1),
  ])

  const task = taskRes.data as TaskRow | null
  if (taskRes.error || !task) {
    console.error('Error fetching task detail:', taskRes.error)
    return { data: null, error: taskRes.error?.message || 'Task not found.' }
  }

  const assigneeRows = assigneesRes.data

  const attachments = (attachmentsRes.data || []) as TaskAttachment[]
  const attachmentsTotalCount = attachmentsRes.count ?? attachments.length
  const commentList = (commentsRes.data as any[]) || []
  const commentsTotalCount = commentsRes.count ?? commentList.length
  const activityList = (activityRes.data as any[]) || []
  const activityTotalCount = activityRes.count ?? activityList.length

  const commentIds = commentList.map((c: any) => c.id)
  const mentionIds = commentList.flatMap((comment) => comment.mentioned_user_ids || [])
  // Batch 2: comment attachments and reactions in parallel
  const [commentAttachmentsRes, commentReactions] = await Promise.all([
    commentIds.length > 0
      ? (supabase as any)
          .from('project_task_comment_attachments')
          .select('id, comment_id, task_id, project_id, file_name, mime_type, size_bytes, cloudinary_url, cloudinary_public_id, resource_type, created_by, created_at')
          .in('comment_id', commentIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    getTaskCommentReactionRows(supabase, commentIds),
  ])

  const userIds = uniqueIds([
    ...commentList.map((comment) => comment.created_by),
    ...activityList.map((entry) => entry.created_by),
    ...mentionIds,
    ...commentReactions.map((reaction) => reaction.created_by),
  ])

  const usersRes =
    userIds.length > 0
      ? await supabase.from('users').select('id, full_name, email, role, photo_url').in('id', userIds)
      : { data: [] }

  const commentAttachmentsList = ((commentAttachmentsRes as any).data as TaskCommentAttachment[] | null) || []
  const users = (usersRes as any).data

  const { userNameMap, userEmailMap, userRoleMap } = buildTaskUserMaps(
    (users as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }> | null) || null
  )

  const attachmentsByComment = new Map<string, TaskCommentAttachment[]>()
  commentAttachmentsList.forEach((attachment) => {
    const existing = attachmentsByComment.get(attachment.comment_id) || []
    existing.push(attachment)
    attachmentsByComment.set(attachment.comment_id, existing)
  })

  const reactionsByComment = buildTaskCommentReactionMap(
    commentReactions,
    { userNameMap, userEmailMap, userRoleMap },
    currentUser.id
  )

  const mappedComments: TaskComment[] = commentList.map((comment) =>
    mapTaskComment(comment, { userNameMap, userEmailMap, userRoleMap }, attachmentsByComment, reactionsByComment)
  )

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
    attachments,
    comments: mappedComments,
    activity_log: mappedActivity,
    commentsTotalCount,
    activityTotalCount,
    attachmentsTotalCount,
  }

  return { data: taskDetail, error: null }
})

const TASK_DETAIL_PAGE_SIZE = 20

export async function getTaskCommentsPage(
  taskId: string,
  page: number
): Promise<ActionResult<{ comments: TaskComment[]; hasMore: boolean }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view comments.' }
  }

  const supabase = await createClient()
  const from = (page - 1) * TASK_DETAIL_PAGE_SIZE
  const to = from + TASK_DETAIL_PAGE_SIZE - 1

  const { data: comments, count } = await (supabase as any)
    .from('project_task_comments')
    .select('id, task_id, comment_text, mentioned_user_ids, created_by, created_at, updated_at', { count: 'exact' })
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
    .range(from, to)

  const commentList = (comments as any[]) || []
  const commentIds = commentList.map((c: any) => c.id)

  const [{ data: commentAttachments }, commentReactions] = await Promise.all([
    commentIds.length > 0
      ? (supabase as any)
          .from('project_task_comment_attachments')
          .select('id, comment_id, task_id, project_id, file_name, mime_type, size_bytes, cloudinary_url, cloudinary_public_id, resource_type, created_by, created_at')
          .in('comment_id', commentIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    getTaskCommentReactionRows(supabase, commentIds),
  ])

  const mentionIds = commentList.flatMap((c: any) => c.mentioned_user_ids || [])
  const userIds = uniqueIds([
    ...commentList.map((c: any) => c.created_by),
    ...mentionIds,
    ...commentReactions.map((reaction) => reaction.created_by),
  ])
  const usersResult =
    userIds.length > 0
      ? await supabase
          .from('users')
          .select('id, full_name, email, role, photo_url')
          .in('id', userIds)
      : { data: [] }
  const users = (usersResult as any).data

  const { userNameMap, userEmailMap, userRoleMap } = buildTaskUserMaps(
    (users as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }> | null) || null
  )
  const attachmentsByComment = new Map<string, TaskCommentAttachment[]>()
  ;((commentAttachments as TaskCommentAttachment[] | null) || []).forEach((att) => {
    const existing = attachmentsByComment.get(att.comment_id) || []
    existing.push(att)
    attachmentsByComment.set(att.comment_id, existing)
  })

  const reactionsByComment = buildTaskCommentReactionMap(
    commentReactions,
    { userNameMap, userEmailMap, userRoleMap },
    currentUser.id
  )

  const mappedComments = commentList.map((c: any) =>
    mapTaskComment(c, { userNameMap, userEmailMap, userRoleMap }, attachmentsByComment, reactionsByComment)
  )
  const totalCount = count ?? 0
  const hasMore = to + 1 < totalCount

  return { data: { comments: mappedComments, hasMore }, error: null }
}

export async function getTaskActivityPage(
  taskId: string,
  page: number
): Promise<ActionResult<{ activity: TaskActivityLogEntry[]; hasMore: boolean }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view activity.' }
  }

  const supabase = await createClient()
  const from = (page - 1) * TASK_DETAIL_PAGE_SIZE
  const to = from + TASK_DETAIL_PAGE_SIZE - 1

  const { data: activity, count } = await (supabase as any)
    .from('project_task_activity_log')
    .select('id, task_id, project_id, event_type, event_meta, created_by, created_at', { count: 'exact' })
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .range(from, to)

  const activityList = (activity as any[]) || []
  const userIds = uniqueIds(activityList.map((e: any) => e.created_by))
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, role, photo_url')
    .in('id', userIds)

  const userNameMap = new Map<string, string>()
  ;((users as Array<{ id: string; full_name: string | null }> | null) || []).forEach((u) => {
    userNameMap.set(u.id, u.full_name || 'Unknown User')
  })

  const mappedActivity: TaskActivityLogEntry[] = activityList.map((e: any) => ({
    id: e.id,
    task_id: e.task_id,
    project_id: e.project_id,
    event_type: e.event_type,
    event_meta: e.event_meta ?? null,
    created_by: e.created_by,
    created_by_name: userNameMap.get(e.created_by) || 'Unknown User',
    created_at: e.created_at,
  }))

  const totalCount = count ?? 0
  const hasMore = to + 1 < totalCount

  return { data: { activity: mappedActivity, hasMore }, error: null }
}

export async function getTaskAttachmentsPage(
  taskId: string,
  page: number
): Promise<ActionResult<{ attachments: TaskAttachment[]; hasMore: boolean }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view attachments.' }
  }

  const supabase = await createClient()
  const from = (page - 1) * TASK_DETAIL_PAGE_SIZE
  const to = from + TASK_DETAIL_PAGE_SIZE - 1

  const { data: attachments, count } = await (supabase as any)
    .from('project_task_attachments')
    .select('id, task_id, project_id, file_name, mime_type, size_bytes, cloudinary_url, cloudinary_public_id, resource_type, created_by, created_at', { count: 'exact' })
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .range(from, to)

  const totalCount = count ?? 0
  const hasMore = to + 1 < totalCount

  return {
    data: {
      attachments: (attachments as TaskAttachment[]) || [],
      hasMore,
    },
    error: null,
  }
}

export async function getTaskMentionableUsers(): Promise<ActionResult<TaskAssignee[]>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view users.' }
  }

  const supabase = await createClient()
  const { data, error } = await (supabase
    .from('users')
    .select('id, full_name, email, role, photo_url, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true }) as any)

  if (error) {
    console.error('Error fetching mentionable users:', error)
    return { data: null, error: error.message || 'Failed to fetch users.' }
  }

  const users = (data || []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null; photo_url?: string | null }>
  return {
    data: users.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role ?? null,
      photo_url: user.photo_url ?? null,
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

  const permissionFlags = await getTaskPermissionFlags(currentUser)
  if (!canManageTasksWithWriteAccess(currentUser, permissionFlags)) {
    return { data: null, error: 'You do not have permission to create tasks.' }
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
    .select('id, project_id, title, description_html, task_type, priority, status, due_date, created_by, created_at, updated_at, in_progress_at, completed_at, actual_minutes')
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
    .select('user_id, users!project_task_assignees_user_id_fkey(full_name, email, role, photo_url)')
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

  const permissionFlags = await getTaskPermissionFlags(currentUser)
  if (!canManageTasksWithWriteAccess(currentUser, permissionFlags)) {
    return { data: null, error: 'You do not have permission to update tasks.' }
  }

  const supabase = await createClient()
  const { data: existing, error: existingError } = await (supabase as any)
    .from('project_tasks')
    .select('id, project_id, title, description_html, task_type, priority, status, due_date, created_by, created_at, updated_at, in_progress_at, completed_at, actual_minutes')
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
    .select('id, project_id, title, description_html, task_type, priority, status, due_date, created_by, created_at, updated_at, in_progress_at, completed_at, actual_minutes')
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
    .select('user_id, users!project_task_assignees_user_id_fkey(full_name, email, role, photo_url)')
    .eq('task_id', task.id)

  after(() => {
    revalidatePath(`/dashboard/projects/${task.project_id}`)
  })

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

  const permissionFlags = await getTaskPermissionFlags(currentUser)
  if (!canManageTasksWithWriteAccess(currentUser, permissionFlags)) {
    return { data: null, error: 'You do not have permission to update assignees.' }
  }

  const supabase = await createClient()
  const { data: task } = await (supabase as any)
    .from('project_tasks')
    .select('id, project_id, title, description_html, task_type, priority, status, due_date, created_by, created_at, updated_at, in_progress_at, completed_at, actual_minutes')
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
    .select('user_id, users!project_task_assignees_user_id_fkey(full_name, email, role, photo_url)')
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
    .select('id, project_id, title, description_html, task_type, priority, status, due_date, created_by, created_at, updated_at, in_progress_at, completed_at, actual_minutes')
    .eq('id', taskId)
    .single()

  if (error || !task) {
    return { data: null, error: error?.message || 'Task not found.' }
  }

  const permissionFlags = await getTaskPermissionFlags(currentUser)
  const canManage = canManageTasksWithWriteAccess(currentUser, permissionFlags)

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
    .select('id, project_id, title, description_html, task_type, priority, status, due_date, created_by, created_at, updated_at, in_progress_at, completed_at, actual_minutes')
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
    .select('user_id, users!project_task_assignees_user_id_fkey(full_name, email, role, photo_url)')
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

  const permissionFlags = await getTaskPermissionFlags(currentUser)
  if (!canManageTasksWithWriteAccess(currentUser, permissionFlags)) {
    return { data: null, error: 'You do not have permission to delete tasks.' }
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
  mentionIds: string[] = [],
  attachments: TaskCommentAttachmentInput[] = []
): Promise<ActionResult<TaskComment>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to add comments.' }
  }

  if (currentUser.role === 'client') {
    return { data: null, error: 'Clients cannot add comments.' }
  }

  const trimmed = commentText.trim()
  if (!trimmed && attachments.length === 0) {
    return { data: null, error: 'Please add comment text or at least one attachment.' }
  }

  for (const attachment of attachments) {
    if (attachment.size_bytes > TASK_MAX_ATTACHMENT_SIZE_BYTES) {
      return { data: null, error: 'One or more attachments exceed the 5MB limit.' }
    }
    if (!TASK_ALLOWED_MIME_TYPES.includes(attachment.mime_type as any)) {
      return { data: null, error: 'One or more attachments are not an allowed file type.' }
    }
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

  const permissionFlags = await getTaskPermissionFlags(currentUser)
  const canManage = canManageTasksWithWriteAccess(currentUser, permissionFlags)

  if (currentUser.role === 'staff' && !canManage) {
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
      comment_text: trimmed || '',
      mentioned_user_ids: mentionList,
      created_by: currentUser.id,
    })
    .select('id, task_id, comment_text, mentioned_user_ids, created_by, created_at, updated_at')
    .single()

  if (error || !comment) {
    console.error('Error creating comment:', error)
    return { data: null, error: error?.message || 'Failed to add comment.' }
  }

  let createdAttachments: TaskCommentAttachment[] = []
  if (attachments.length > 0) {
    const { data: insertedAttachments, error: attachmentError } = await (supabase as any)
      .from('project_task_comment_attachments')
      .insert(
        attachments.map((attachment) => ({
          comment_id: comment.id,
          task_id: taskId,
          project_id: task.project_id,
          file_name: attachment.file_name,
          mime_type: attachment.mime_type,
          size_bytes: attachment.size_bytes,
          cloudinary_url: attachment.cloudinary_url,
          cloudinary_public_id: attachment.cloudinary_public_id,
          resource_type: attachment.resource_type,
          created_by: currentUser.id,
        }))
      )
      .select('id, comment_id, task_id, project_id, file_name, mime_type, size_bytes, cloudinary_url, cloudinary_public_id, resource_type, created_by, created_at')

    if (attachmentError) {
      console.error('Error creating task comment attachments:', attachmentError)
      await deleteCloudinaryAssets(
        attachments.map((attachment) => ({
          publicId: attachment.cloudinary_public_id,
          resourceType: attachment.resource_type,
        }))
      )
      await (supabase as any).from('project_task_comments').delete().eq('id', comment.id)
      return { data: null, error: attachmentError.message || 'Failed to add comment attachments.' }
    }

    createdAttachments = (insertedAttachments as TaskCommentAttachment[]) || []
  }

  await insertTaskActivity(supabase, {
    taskId,
    projectId: task.project_id,
    eventType: 'comment_added',
    eventMeta: {
      mentioned_user_ids: mentionList,
      attachment_count: createdAttachments.length,
    },
    createdBy: currentUser.id,
  })

  if (mentionList.length > 0) {
    const notificationBody = trimmed
      ? trimmed.slice(0, 120)
      : createdAttachments.length > 0
        ? `Added ${createdAttachments.length} attachment${createdAttachments.length > 1 ? 's' : ''}.`
        : null

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
          body: notificationBody,
          meta: { comment_id: comment.id },
          created_by: currentUser.id,
        }))
    )
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, role, photo_url')
    .in('id', uniqueIds([comment.created_by, ...mentionList]))

  const { userNameMap, userEmailMap, userRoleMap } = buildTaskUserMaps(
    (users as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }> | null) || null
  )
  const attachmentsByComment = new Map<string, TaskCommentAttachment[]>()
  attachmentsByComment.set(comment.id, createdAttachments)
  const reactionsByComment = new Map<string, TaskCommentReaction[]>()

  return {
    data: mapTaskComment(comment, { userNameMap, userEmailMap, userRoleMap }, attachmentsByComment, reactionsByComment),
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

  if (existing.created_by !== currentUser.id) {
    return { data: null, error: 'You can only edit your own comments.' }
  }

  const trimmed = commentText.trim()
  if (!trimmed) {
    const { count: attachmentCount } = await (supabase as any)
      .from('project_task_comment_attachments')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId)

    if ((attachmentCount ?? 0) === 0) {
      return { data: null, error: 'Please add comment text or keep at least one attachment.' }
    }
  }

  const mentionList = uniqueIds(mentionIds)

  const { data: comment, error } = await (supabase as any)
    .from('project_task_comments')
    .update({ comment_text: trimmed || '', mentioned_user_ids: mentionList })
    .eq('id', commentId)
    .select('id, task_id, comment_text, mentioned_user_ids, created_by, created_at, updated_at')
    .single()

  if (error || !comment) {
    console.error('Error updating comment:', error)
    return { data: null, error: error?.message || 'Failed to update comment.' }
  }

  const [attachmentsRes, reactions] = await Promise.all([
    (supabase as any)
      .from('project_task_comment_attachments')
      .select('id, comment_id, task_id, project_id, file_name, mime_type, size_bytes, cloudinary_url, cloudinary_public_id, resource_type, created_by, created_at')
      .eq('comment_id', comment.id)
      .order('created_at', { ascending: true }),
    getTaskCommentReactionRows(supabase, [comment.id]),
  ])

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, role, photo_url')
    .in('id', uniqueIds([comment.created_by, ...mentionList, ...reactions.map((reaction) => reaction.created_by)]))

  const { userNameMap, userEmailMap, userRoleMap } = buildTaskUserMaps(
    (users as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }> | null) || null
  )
  const attachmentsByComment = new Map<string, TaskCommentAttachment[]>()
  attachmentsByComment.set(comment.id, ((attachmentsRes as any).data as TaskCommentAttachment[] | null) || [])
  const reactionsByComment = buildTaskCommentReactionMap(
    reactions,
    { userNameMap, userEmailMap, userRoleMap },
    currentUser.id
  )

  return {
    data: mapTaskComment(comment, { userNameMap, userEmailMap, userRoleMap }, attachmentsByComment, reactionsByComment),
    error: null,
  }
}

export async function toggleTaskCommentReaction(
  commentId: string,
  emoji: string
): Promise<ActionResult<{ commentId: string; reactions: TaskCommentReaction[] }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to react to comments.' }
  }

  if (currentUser.role === 'client') {
    return { data: null, error: 'Clients cannot react to comments.' }
  }

  const normalizedEmoji = normalizeTaskCommentReactionEmoji(emoji)
  if (!isTaskCommentReactionEmojiSupported(normalizedEmoji)) {
    return { data: null, error: 'Unsupported reaction emoji.' }
  }

  const supabase = await createClient()
  const { data: comment } = await (supabase as any)
    .from('project_task_comments')
    .select('id, task_id')
    .eq('id', commentId)
    .single()

  if (!comment) {
    return { data: null, error: 'Comment not found.' }
  }

  const { data: task } = await (supabase as any)
    .from('project_tasks')
    .select('project_id')
    .eq('id', comment.task_id)
    .single()

  if (!task) {
    return { data: null, error: 'Task not found.' }
  }

  const permissionFlags = await getTaskPermissionFlags(currentUser)
  const canManage = canManageTasksWithWriteAccess(currentUser, permissionFlags)

  if (currentUser.role === 'staff' && !canManage) {
    const assigned = await isUserAssignedToProject(supabase, task.project_id, currentUser.id)
    if (!assigned) {
      return { data: null, error: 'You do not have permission to react to this comment.' }
    }
  }

  const { data: existingReaction } = await (supabase as any)
    .from('project_task_comment_reactions')
    .select('id')
    .eq('comment_id', commentId)
    .eq('created_by', currentUser.id)
    .eq('emoji', normalizedEmoji)
    .maybeSingle()

  if (existingReaction?.id) {
    const { error: deleteError } = await (supabase as any)
      .from('project_task_comment_reactions')
      .delete()
      .eq('id', existingReaction.id)

    if (deleteError) {
      console.error('Error removing task comment reaction:', deleteError)
      return { data: null, error: deleteError.message || 'Failed to remove reaction.' }
    }
  } else {
    const { error: insertError } = await (supabase as any)
      .from('project_task_comment_reactions')
      .insert({
        comment_id: commentId,
        task_id: comment.task_id,
        emoji: normalizedEmoji,
        created_by: currentUser.id,
      })

    if (insertError) {
      console.error('Error creating task comment reaction:', insertError)
      return { data: null, error: insertError.message || 'Failed to add reaction.' }
    }
  }

  const reactions = await getTaskCommentReactionRows(supabase, [commentId])
  const reactionUserIds = uniqueIds(reactions.map((reaction) => reaction.created_by))
  const { data: users } =
    reactionUserIds.length > 0
      ? await supabase.from('users').select('id, full_name, email, role').in('id', reactionUserIds)
      : { data: [] }

  const { userNameMap, userEmailMap, userRoleMap } = buildTaskUserMaps(
    (users as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }> | null) || null
  )
  const reactionsByComment = buildTaskCommentReactionMap(
    reactions,
    { userNameMap, userEmailMap, userRoleMap },
    currentUser.id
  )

  revalidatePath(`/dashboard/projects/${task.project_id}`)

  return {
    data: {
      commentId,
      reactions: reactionsByComment.get(commentId) || [],
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

  if (existing.created_by !== currentUser.id) {
    return { data: null, error: 'You can only delete your own comments.' }
  }

  const { data: attachments } = await (supabase as any)
    .from('project_task_comment_attachments')
    .select('cloudinary_public_id, resource_type')
    .eq('comment_id', commentId)

  const { error } = await (supabase as any).from('project_task_comments').delete().eq('id', commentId)
  if (error) {
    return { data: null, error: error.message || 'Failed to delete comment.' }
  }

  const attachmentList =
    (attachments as Array<{ cloudinary_public_id: string; resource_type: string }> | null) || []
  if (attachmentList.length > 0) {
    await deleteCloudinaryAssets(
      attachmentList.map((attachment) => ({
        publicId: attachment.cloudinary_public_id,
        resourceType: attachment.resource_type,
      }))
    )
  }

  return { data: { taskId: existing.task_id }, error: null }
}

export async function deleteTaskCommentAttachment(
  attachmentId: string
): Promise<ActionResult<{ taskId: string; commentId: string; deletedCommentId: string | null }>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to delete attachments.' }
  }

  if (currentUser.role === 'client') {
    return { data: null, error: 'Clients cannot delete comment attachments.' }
  }

  const supabase = await createClient()
  const { data: attachment } = await (supabase as any)
    .from('project_task_comment_attachments')
    .select('id, comment_id, task_id, project_id, cloudinary_public_id, resource_type')
    .eq('id', attachmentId)
    .single()

  if (!attachment) {
    return { data: null, error: 'Attachment not found.' }
  }

  const attachmentRow = attachment as {
    id: string
    comment_id: string
    task_id: string
    project_id: string
    cloudinary_public_id: string
    resource_type: string
  }

  const { data: comment } = await (supabase as any)
    .from('project_task_comments')
    .select('id, created_by, comment_text')
    .eq('id', attachmentRow.comment_id)
    .single()

  if (!comment) {
    return { data: null, error: 'Comment not found.' }
  }

  const commentRow = comment as { id: string; created_by: string; comment_text: string }
  if (commentRow.created_by !== currentUser.id) {
    return { data: null, error: 'You can only delete attachments from your own comments.' }
  }

  const { error: deleteError } = await (supabase as any)
    .from('project_task_comment_attachments')
    .delete()
    .eq('id', attachmentId)

  if (deleteError) {
    return { data: null, error: deleteError.message || 'Failed to delete comment attachment.' }
  }

  after(() =>
    deleteCloudinaryAssets([
      {
        publicId: attachmentRow.cloudinary_public_id,
        resourceType: attachmentRow.resource_type,
      },
    ])
  )

  let deletedCommentId: string | null = null
  if (!(commentRow.comment_text || '').trim()) {
    const { count } = await (supabase as any)
      .from('project_task_comment_attachments')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentRow.id)

    if ((count ?? 0) === 0) {
      const { error: deleteCommentError } = await (supabase as any)
        .from('project_task_comments')
        .delete()
        .eq('id', commentRow.id)
      if (!deleteCommentError) {
        deletedCommentId = commentRow.id
      }
    }
  }

  revalidatePath(`/dashboard/projects/${attachmentRow.project_id}`)

  return {
    data: {
      taskId: attachmentRow.task_id,
      commentId: commentRow.id,
      deletedCommentId,
    },
    error: null,
  }
}

export async function getTaskCommentUploadSignature(
  taskId: string
): Promise<ActionResult<CloudinaryUploadSignature>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to upload comment attachments.' }
  }

  if (currentUser.role === 'client') {
    return { data: null, error: 'Clients cannot upload comment attachments.' }
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

  const permissionFlags = await getTaskPermissionFlags(currentUser)
  if (!canManageTasksWithWriteAccess(currentUser, permissionFlags)) {
    if (currentUser.role !== 'staff') {
      return { data: null, error: 'You do not have permission to upload comment attachments.' }
    }
    const isAssigned = await isUserAssignedToProject(supabase, task.project_id, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to upload comment attachments.' }
    }
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

export async function getTaskUploadSignature(
  projectId: string
): Promise<ActionResult<CloudinaryUploadSignature>> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You do not have permission to upload attachments.' }
  }

  const permissionFlags = await getTaskPermissionFlags(currentUser)
  if (!canManageTasksWithWriteAccess(currentUser, permissionFlags)) {
    return { data: null, error: 'You do not have permission to upload attachments.' }
  }

  const supabase = await createClient()
  const canAccess =
    permissionFlags.canWriteProjects ||
    permissionFlags.canReadProjectTasks ||
    (await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'read'))
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
  if (!currentUser) {
    return { data: null, error: 'You do not have permission to upload attachments.' }
  }

  const permissionFlags = await getTaskPermissionFlags(currentUser)
  if (!canManageTasksWithWriteAccess(currentUser, permissionFlags)) {
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
    .select('id, task_id, project_id, file_name, mime_type, size_bytes, cloudinary_url, cloudinary_public_id, resource_type, created_by, created_at')

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
  if (!currentUser) {
    return { data: null, error: 'You do not have permission to delete attachments.' }
  }

  const permissionFlags = await getTaskPermissionFlags(currentUser)
  if (!canManageTasksWithWriteAccess(currentUser, permissionFlags)) {
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

  after(() =>
    deleteCloudinaryAssets([
      { publicId: attachment.cloudinary_public_id, resourceType: attachment.resource_type },
    ])
  )

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
