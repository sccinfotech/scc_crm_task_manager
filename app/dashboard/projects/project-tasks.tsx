'use client'

import { useState, useEffect, useCallback, useRef, useId, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/components/ui/toast-context'
import { Tooltip } from '@/app/components/ui/tooltip'
import { EmptyState } from '@/app/components/empty-state'
import { ProjectTasksRichEditor } from './project-tasks-rich-editor'
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  TASK_STATUS_DOT_COLORS,
  TASK_STATUS_HEADER_BG,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
  TASK_PRIORITY_FLAG_COLORS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  TASK_MAX_ATTACHMENT_SIZE_BYTES,
  TASK_ALLOWED_MIME_TYPES,
  TASK_ALLOWED_EXTENSIONS,
  TASK_EXTENSION_MIME_MAP,
  type TaskStatus,
  type TaskPriority,
  type TaskType,
} from '@/lib/projects/tasks-constants'
import {
  getProjectTasks,
  getProjectTaskDetail,
  createProjectTask,
  updateProjectTask,
  updateTaskStatus,
  updateTaskAssignees,
  deleteProjectTask,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
  deleteTaskCommentAttachment,
  getTaskCommentUploadSignature,
  getTaskUploadSignature,
  createTaskAttachments,
  deleteTaskAttachment,
  getTaskMentionableUsers,
  type ProjectTaskListItem,
  type ProjectTaskDetail,
  type TaskComment,
  type TaskCommentAttachmentInput,
  type TaskAttachment,
  type TaskActivityLogEntry,
  type TaskAssignee,
  type TaskFilters,
} from '@/lib/projects/tasks-actions'
import type { StaffSelectOption } from '@/lib/users/actions'

const MAX_FILE_MB = TASK_MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)
const ACCEPTED_FILE_TYPES = Array.from(
  new Set<string>([
    ...TASK_ALLOWED_MIME_TYPES,
    ...TASK_ALLOWED_EXTENSIONS.map((extension) => `.${extension}`),
  ])
).join(',')

const TASK_ALLOWED_MIME_TYPE_SET = new Set<string>(TASK_ALLOWED_MIME_TYPES)
const FILTER_DROPDOWN_TRIGGER_CLASSES =
  'h-9 min-w-[7rem] rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-slate-300 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20'

type TaskAttachmentFileValidation =
  | { ok: true; mimeType: string }
  | { ok: false; title: string; message: string }

function getTaskAttachmentFileExtension(fileName: string) {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

function normalizeTaskAttachmentMimeType(mimeType: string | null | undefined) {
  if (!mimeType) return ''
  const normalized = mimeType.trim().toLowerCase()
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized
}

function resolveTaskAttachmentMimeType(file: Pick<File, 'name' | 'type'>): string | null {
  const normalizedMimeType = normalizeTaskAttachmentMimeType(file.type)
  if (normalizedMimeType && TASK_ALLOWED_MIME_TYPE_SET.has(normalizedMimeType)) {
    return normalizedMimeType
  }

  const extension = getTaskAttachmentFileExtension(file.name)
  return TASK_EXTENSION_MIME_MAP[extension] ?? null
}

function validateTaskAttachmentFile(file: File): TaskAttachmentFileValidation {
  if (file.size > TASK_MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      ok: false,
      title: 'File too large',
      message: `${file.name} exceeds ${MAX_FILE_MB} MB.`,
    }
  }

  const mimeType = resolveTaskAttachmentMimeType(file)
  if (!mimeType) {
    return {
      ok: false,
      title: 'File type not allowed',
      message: `${file.name} is not a supported type.`,
    }
  }

  return { ok: true, mimeType }
}

async function uploadTaskFilesToCloudinary(
  files: File[],
  signature: { apiKey: string; timestamp: number; signature: string; folder: string; cloudName: string }
): Promise<
  | {
      ok: true
      uploaded: TaskCommentAttachmentInput[]
    }
  | {
      ok: false
      errorTitle: string
      errorMessage: string
    }
> {
  const uploaded: TaskCommentAttachmentInput[] = []

  for (const file of files) {
    const validation = validateTaskAttachmentFile(file)
    if (!validation.ok) {
      return { ok: false, errorTitle: validation.title, errorMessage: validation.message }
    }

    const mimeType = validation.mimeType
    const formData = new FormData()
    formData.append('file', file)
    formData.append('api_key', signature.apiKey)
    formData.append('timestamp', String(signature.timestamp))
    formData.append('signature', signature.signature)
    formData.append('folder', signature.folder)

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`,
        { method: 'POST', body: formData }
      )
      if (!response.ok) throw new Error('Upload failed')
      const data = await response.json()

      uploaded.push({
        file_name: file.name,
        mime_type: mimeType,
        size_bytes: file.size,
        cloudinary_url: data.secure_url,
        cloudinary_public_id: data.public_id,
        resource_type: data.resource_type ?? (mimeType.startsWith('image/') ? 'image' : 'raw'),
      })
    } catch {
      return {
        ok: false,
        errorTitle: 'Upload failed',
        errorMessage: `Could not upload ${file.name}.`,
      }
    }
  }

  return { ok: true, uploaded }
}
/** When selectedTaskId is this value, Task Detail panel opens in creation mode (no popup). */
const CREATE_TASK_SENTINEL = '__create__'

function isImageAttachment(a: TaskAttachment) {
  return (a.mime_type && a.mime_type.startsWith('image/')) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.file_name || '')
}

function formatAttachmentDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

function getInitials(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatRelative(dateString: string) {
  const d = new Date(dateString)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatRoleLabel(role: string | null | undefined) {
  if (!role) return ''
  return role
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getUserName(user: { id: string; full_name: string | null; email: string | null }) {
  return user.full_name ?? user.email ?? user.id
}

function getUserTagLabel(user: { id: string; full_name: string | null; email: string | null; role?: string | null }) {
  const roleLabel = formatRoleLabel(user.role)
  const name = getUserName(user)
  return roleLabel ? `${name} (${roleLabel})` : name
}

function PriorityFlagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? 'h-4 w-4 flex-shrink-0'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  )
}

const TASK_TYPE_ICONS: Record<TaskType, ReactElement> = {
  feature: (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  bug: (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      <path d="M4 12h16M4 8h4m12 0h-4M4 16h4m12 0h-4" />
    </svg>
  ),
  improvement: (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 0115.414-2.086 2.25 2.25 0 00-2.086-2.086L9 11.25 2.25 18" />
      <path d="M12 9l-3 3m0 0l3 3m-3-3h6" />
    </svg>
  ),
  research: (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  other: (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
}

function TaskTypeIcon({ type, className }: { type: TaskType; className?: string }) {
  return <span className={className}>{TASK_TYPE_ICONS[type]}</span>
}

const TASK_BOARD_COLUMN_STYLES: Record<TaskStatus, string> = {
  todo: 'border-slate-200 bg-slate-100/70',
  in_progress: 'border-amber-200 bg-amber-100/55',
  review: 'border-indigo-200 bg-indigo-100/55',
  done: 'border-cyan-200 bg-cyan-100/55',
  completed: 'border-emerald-200 bg-emerald-100/55',
}

const TASK_BOARD_HEADER_STYLES: Record<TaskStatus, string> = TASK_STATUS_HEADER_BG

function stripHtmlToText(html: string | null | undefined) {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTaskDescriptionPreview(html: string | null | undefined, maxLength = 120) {
  const plain = stripHtmlToText(html)
  if (!plain) return ''
  if (plain.length <= maxLength) return plain
  return `${plain.slice(0, maxLength).trimEnd()}…`
}

function parseLocalDate(dateString: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (!match) return new Date(dateString)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function getTaskDueDateMeta(dueDate: string | null): { label: string; className: string } {
  if (!dueDate) {
    return {
      label: 'No date',
      className: 'border-slate-200 bg-slate-100 text-slate-500',
    }
  }

  const due = parseLocalDate(dueDate)
  if (Number.isNaN(due.getTime())) {
    return {
      label: formatShortDate(dueDate),
      className: 'border-slate-200 bg-slate-100 text-slate-600',
    }
  }

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.round((dueDay.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000))

  if (diffDays < 0) {
    return {
      label: formatShortDate(dueDate),
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    }
  }

  if (diffDays === 0) {
    return {
      label: 'Today',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  if (diffDays === 1) {
    return {
      label: 'Tomorrow',
      className: 'border-orange-200 bg-orange-50 text-orange-700',
    }
  }

  return {
    label: formatShortDate(dueDate),
    className: diffDays <= 3 ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600',
  }
}

interface ProjectTasksProps {
  projectId: string
  canManageTasks: boolean
  userRole: string
  currentUserId: string | undefined
  teamMembers: StaffSelectOption[]
  className?: string
}

export function ProjectTasks({
  projectId,
  canManageTasks,
  userRole,
  currentUserId,
  teamMembers,
  className = '',
}: ProjectTasksProps) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [isMobile, setIsMobile] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all',
    priority: 'all',
    task_type: 'all',
    mine_only: false,
  })
  const [tasks, setTasks] = useState<ProjectTaskListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskDetail, setTaskDetail] = useState<ProjectTaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [createModalDefaultStatus, setCreateModalDefaultStatus] = useState<TaskStatus | null>(null)
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<TaskStatus, boolean>>(() =>
    TASK_STATUSES.reduce((acc, s) => ({ ...acc, [s]: false }), {} as Record<TaskStatus, boolean>)
  )
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null)
  const [mentionableUsers, setMentionableUsers] = useState<TaskAssignee[]>([])
  const [boardDragState, setBoardDragState] = useState<{ taskId: string; fromStatus: TaskStatus } | null>(null)
  const [boardDragOverStatus, setBoardDragOverStatus] = useState<TaskStatus | null>(null)
  /** All active users (any role) for assignee dropdowns; same shape as StaffSelectOption */
  const assignableUsers: StaffSelectOption[] = mentionableUsers

  const canUpdateStatus =
    canManageTasks || (userRole === 'staff' && Boolean(currentUserId))
  const canEditTask = canManageTasks
  const canManageAttachments = canManageTasks
  const effectiveViewMode: 'list' | 'board' = isMobile ? 'list' : viewMode

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleViewportChange = () => {
      const mobile = mediaQuery.matches
      setIsMobile(mobile)
      if (mobile) {
        setViewMode('list')
      }
    }

    handleViewportChange()
    mediaQuery.addEventListener('change', handleViewportChange)
    return () => mediaQuery.removeEventListener('change', handleViewportChange)
  }, [])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    const result = await getProjectTasks(projectId, {
      ...filters,
      search: search.trim() || undefined,
    })
    setLoading(false)
    if (result.error) {
      showError('Load failed', result.error)
      return
    }
    setTasks(result.data ?? [])
  }, [projectId, filters, search, showError])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const loadTaskDetail = useCallback(
    async (taskId: string) => {
      setDetailLoading(true)
      setTaskDetail(null)
      const result = await getProjectTaskDetail(taskId)
      setDetailLoading(false)
      if (result.error) {
        showError('Load failed', result.error)
        setSelectedTaskId(null)
        return
      }
      setTaskDetail(result.data ?? null)
    },
    [showError]
  )

  useEffect(() => {
    if (selectedTaskId && selectedTaskId !== CREATE_TASK_SENTINEL) loadTaskDetail(selectedTaskId)
    else if (selectedTaskId !== CREATE_TASK_SENTINEL) setTaskDetail(null)
  }, [selectedTaskId, loadTaskDetail])

  useEffect(() => {
    getTaskMentionableUsers().then((r) => {
      if (r.data) setMentionableUsers(r.data)
    })
  }, [])

  const handleStatusChange = async (taskId: string, nextStatus: TaskStatus) => {
    const result = await updateTaskStatus(taskId, nextStatus)
    if (result.error) {
      showError('Update failed', result.error)
      return
    }
    showSuccess('Status updated', 'Task status has been updated.')
    if (result.data) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? result.data! : t)))
      if (taskDetail?.id === taskId) {
        setTaskDetail((prev) => (prev ? { ...prev, ...result.data } : null))
      }
    }
    router.refresh()
  }

  const handleBoardDragStart = useCallback(
    (taskId: string, fromStatus: TaskStatus, event: React.DragEvent<HTMLElement>) => {
      if (!canUpdateStatus) {
        event.preventDefault()
        return
      }
      setBoardDragState({ taskId, fromStatus })
      setBoardDragOverStatus(fromStatus)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', taskId)
    },
    [canUpdateStatus]
  )

  const resetBoardDragState = useCallback(() => {
    setBoardDragState(null)
    setBoardDragOverStatus(null)
  }, [])

  const handleBoardDragEnd = useCallback(() => {
    resetBoardDragState()
  }, [resetBoardDragState])

  const handleBoardColumnDragOver = useCallback(
    (status: TaskStatus, event: React.DragEvent<HTMLElement>) => {
      if (!boardDragState || !canUpdateStatus) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (boardDragOverStatus !== status) {
        setBoardDragOverStatus(status)
      }
    },
    [boardDragOverStatus, boardDragState, canUpdateStatus]
  )

  const handleBoardColumnDrop = useCallback(
    async (nextStatus: TaskStatus, event: React.DragEvent<HTMLElement>) => {
      if (!canUpdateStatus) return
      event.preventDefault()
      event.stopPropagation()
      const fallbackTaskId = event.dataTransfer.getData('text/plain')
      const draggedTaskId = boardDragState?.taskId || fallbackTaskId
      if (!draggedTaskId) {
        resetBoardDragState()
        return
      }
      const currentTask = tasks.find((task) => task.id === draggedTaskId)
      const fromStatus = boardDragState?.fromStatus ?? currentTask?.status
      resetBoardDragState()
      if (!fromStatus) return

      if (fromStatus === nextStatus) return

      setTasks((prev) => prev.map((task) => (task.id === draggedTaskId ? { ...task, status: nextStatus } : task)))
      if (taskDetail?.id === draggedTaskId) {
        setTaskDetail((prev) => (prev ? { ...prev, status: nextStatus } : null))
      }

      const result = await updateTaskStatus(draggedTaskId, nextStatus)
      if (result.error) {
        setTasks((prev) => prev.map((task) => (task.id === draggedTaskId ? { ...task, status: fromStatus } : task)))
        if (taskDetail?.id === draggedTaskId) {
          setTaskDetail((prev) => (prev ? { ...prev, status: fromStatus } : null))
        }
        showError('Update failed', result.error)
        return
      }

      if (result.data) {
        setTasks((prev) => prev.map((task) => (task.id === draggedTaskId ? result.data! : task)))
        if (taskDetail?.id === draggedTaskId) {
          setTaskDetail((prev) => (prev ? { ...prev, ...result.data! } : null))
        }
      }
      router.refresh()
    },
    [boardDragState, canUpdateStatus, resetBoardDragState, router, showError, taskDetail?.id, tasks]
  )

  const handleCreateTask = async (payload: {
    title: string
    description_html?: string | null
    task_type?: TaskType | null
    priority?: TaskPriority | null
    status?: TaskStatus | null
    due_date?: string | null
    assignee_ids?: string[]
    initial_files?: File[]
  }) => {
    const { initial_files, ...createPayload } = payload
    const result = await createProjectTask(projectId, createPayload)
    if (result.error) {
      showError('Create failed', result.error)
      return result
    }
    setCreateModalDefaultStatus(null)
    if (result.data) {
      setTasks((prev) => [result.data!, ...prev])
      setSelectedTaskId(result.data.id)
    } else {
      setSelectedTaskId(null)
    }
    const taskId = result.data?.id
    if (taskId && initial_files?.length) {
      const sigResult = await getTaskUploadSignature(projectId)
      if (sigResult.error || !sigResult.data) {
        showError('Upload failed', sigResult.error ?? 'Could not prepare upload.')
        return result
      }
      const signature = sigResult.data
      const uploaded: Array<{ file_name: string; mime_type: string; size_bytes: number; cloudinary_url: string; cloudinary_public_id: string; resource_type: string }> = []
      for (const file of initial_files) {
        const validation = validateTaskAttachmentFile(file)
        if (!validation.ok) {
          showError(validation.title, validation.message)
          break
        }
        const mimeType = validation.mimeType
        const formData = new FormData()
        formData.append('file', file)
        formData.append('api_key', signature.apiKey)
        formData.append('timestamp', String(signature.timestamp))
        formData.append('signature', signature.signature)
        formData.append('folder', signature.folder)
        try {
          const res = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`, { method: 'POST', body: formData })
          if (!res.ok) throw new Error('Upload failed')
          const data = await res.json()
          uploaded.push({
            file_name: file.name,
            mime_type: mimeType,
            size_bytes: file.size,
            cloudinary_url: data.secure_url,
            cloudinary_public_id: data.public_id,
            resource_type: data.resource_type ?? (mimeType.startsWith('image/') ? 'image' : 'raw'),
          })
        } catch {
          showError('Upload failed', `Could not upload ${file.name}.`)
          break
        }
      }
      if (uploaded.length > 0) {
        const createResult = await createTaskAttachments(taskId, uploaded)
        if (!createResult.error) {
          loadTaskDetail(taskId)
        } else {
          showError('Save failed', createResult.error)
        }
      }
    }
    return result
  }

  const handleUpdateTask = async (
    taskId: string,
    payload: {
      title?: string
      description_html?: string | null
      task_type?: TaskType | null
      priority?: TaskPriority | null
      status?: TaskStatus | null
      due_date?: string | null
    }
  ) => {
    const result = await updateProjectTask(taskId, payload)
    if (result.error) {
      showError('Update failed', result.error)
      return result
    }
    const isDescriptionOnly = Object.keys(payload).length === 1 && 'description_html' in payload
    if (!isDescriptionOnly) {
      showSuccess('Task updated', 'Changes have been saved.')
    }
    if (result.data) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? result.data! : t)))
      if (taskDetail?.id === taskId) {
        setTaskDetail((prev) => (prev ? { ...prev, ...result.data } : null))
      }
    }
    router.refresh()
    return result
  }

  const handleDeleteTask = async (taskId: string) => {
    const result = await deleteProjectTask(taskId)
    if (result.error) {
      showError('Delete failed', result.error)
      return
    }
    setDeleteConfirmTaskId(null)
    setSelectedTaskId((id) => (id === taskId ? null : id))
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    showSuccess('Task deleted', 'Task has been removed.')
    router.refresh()
  }

  const handleAssigneesChange = async (taskId: string, assigneeIds: string[]) => {
    const result = await updateTaskAssignees(taskId, assigneeIds)
    if (result.error) {
      showError('Update failed', result.error)
      return
    }
    showSuccess('Assignees updated', 'Task assignees have been updated.')
    if (result.data) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? result.data! : t)))
      if (taskDetail?.id === taskId) {
        setTaskDetail((prev) => (prev ? { ...prev, assignees: result.data!.assignees } : null))
      }
    }
    router.refresh()
  }

  const handleDueDateChange = async (taskId: string, dueDate: string | null) => {
    const result = await updateProjectTask(taskId, { due_date: dueDate || null })
    if (result.error) {
      showError('Update failed', result.error)
      return
    }
    showSuccess('Due date updated', '')
    if (result.data) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? result.data! : t)))
      if (taskDetail?.id === taskId) {
        setTaskDetail((prev) => (prev ? { ...prev, due_date: result.data!.due_date } : null))
      }
    }
    router.refresh()
  }

  const handlePriorityChange = async (taskId: string, priority: TaskPriority | null) => {
    const result = await updateProjectTask(taskId, { priority })
    if (result.error) {
      showError('Update failed', result.error)
      return
    }
    showSuccess('Priority updated', '')
    if (result.data) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? result.data! : t)))
      if (taskDetail?.id === taskId) {
        setTaskDetail((prev) => (prev ? { ...prev, priority: result.data!.priority } : null))
      }
    }
    router.refresh()
  }

  const handleAddComment = async (
    taskId: string,
    commentText: string,
    mentionIds: string[],
    files: File[] = []
  ): Promise<boolean> => {
    const trimmed = commentText.trim()
    if (!trimmed && files.length === 0) {
      showError('Comment required', 'Add a comment or at least one attachment before posting.')
      return false
    }

    let uploadedAttachments: TaskCommentAttachmentInput[] = []
    if (files.length > 0) {
      const signatureResult = await getTaskCommentUploadSignature(taskId)
      if (signatureResult.error || !signatureResult.data) {
        showError('Upload failed', signatureResult.error ?? 'Could not prepare upload.')
        return false
      }

      const uploadResult = await uploadTaskFilesToCloudinary(files, signatureResult.data)
      if (!uploadResult.ok) {
        showError(uploadResult.errorTitle, uploadResult.errorMessage)
        return false
      }

      uploadedAttachments = uploadResult.uploaded
    }

    const result = await createTaskComment(taskId, trimmed, mentionIds, uploadedAttachments)
    if (result.error) {
      showError('Comment failed', result.error)
      return false
    }
    showSuccess('Comment added', '')
    if (result.data && taskDetail?.id === taskId) {
      setTaskDetail((prev) =>
        prev ? { ...prev, comments: [...prev.comments, result.data!] } : null
      )
    }
    router.refresh()
    return true
  }

  const handleUpdateComment = async (
    taskId: string,
    commentId: string,
    commentText: string,
    mentionIds: string[]
  ) => {
    const result = await updateTaskComment(commentId, commentText, mentionIds)
    if (result.error) {
      showError('Update failed', result.error)
      return
    }
    showSuccess('Comment updated', '')
    if (result.data && taskDetail?.id === taskId) {
      setTaskDetail((prev) =>
        prev
          ? { ...prev, comments: prev.comments.map((c) => (c.id === commentId ? result.data! : c)) }
          : null
      )
    }
    router.refresh()
  }

  const handleDeleteComment = async (taskId: string, commentId: string) => {
    const result = await deleteTaskComment(commentId)
    if (result.error) {
      showError('Delete failed', result.error)
      return
    }
    showSuccess('Comment removed', '')
    if (taskDetail?.id === taskId) {
      setTaskDetail((prev) =>
        prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) } : null
      )
    }
    router.refresh()
  }

  const handleDeleteCommentAttachment = async (
    taskId: string,
    commentId: string,
    attachmentId: string
  ): Promise<void> => {
    const result = await deleteTaskCommentAttachment(attachmentId)
    if (result.error || !result.data) {
      showError('Delete failed', result.error ?? 'Failed to delete attachment.')
      return
    }

    if (taskDetail?.id === taskId) {
      setTaskDetail((prev) => {
        if (!prev) return prev
        if (result.data?.deletedCommentId) {
          return {
            ...prev,
            comments: prev.comments.filter((comment) => comment.id !== result.data!.deletedCommentId),
          }
        }

        return {
          ...prev,
          comments: prev.comments.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  attachments: comment.attachments.filter((attachment) => attachment.id !== attachmentId),
                }
              : comment
          ),
        }
      })
    }

    showSuccess('Attachment removed', '')
    router.refresh()
  }

  const handleUploadAttachments = async (
    taskId: string,
    files: File[]
  ): Promise<boolean> => {
    const sigResult = await getTaskUploadSignature(projectId)
    if (sigResult.error || !sigResult.data) {
      showError('Upload failed', sigResult.error ?? 'Could not prepare upload.')
      return false
    }
    const uploadResult = await uploadTaskFilesToCloudinary(files, sigResult.data)
    if (!uploadResult.ok) {
      showError(uploadResult.errorTitle, uploadResult.errorMessage)
      return false
    }

    const uploaded = uploadResult.uploaded
    const createResult = await createTaskAttachments(taskId, uploaded)
    if (createResult.error) {
      showError('Save failed', createResult.error)
      return false
    }
    if (createResult.data && taskDetail?.id === taskId) {
      setTaskDetail((prev) =>
        prev
          ? { ...prev, attachments: [...prev.attachments, ...createResult.data!] }
          : null
      )
    }
    loadTasks()
    router.refresh()
    return true
  }

  const handleRemoveAttachment = async (attachmentId: string) => {
    const result = await deleteTaskAttachment(attachmentId)
    if (result.error) {
      showError('Delete failed', result.error)
      return
    }
    if (taskDetail) {
      setTaskDetail((prev) =>
        prev
          ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== attachmentId) }
          : null
      )
    }
    router.refresh()
  }

  const tasksByStatus = TASK_STATUSES.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status)
      return acc
    },
    {} as Record<TaskStatus, ProjectTaskListItem[]>
  )
  const deleteConfirmTaskTitle = deleteConfirmTaskId
    ? tasks.find((task) => task.id === deleteConfirmTaskId)?.title ??
      (taskDetail?.id === deleteConfirmTaskId ? taskDetail.title : null)
    : null
  const selectedStatusFilter = Array.isArray(filters.status) ? 'all' : (filters.status ?? 'all')
  const selectedPriorityFilter = Array.isArray(filters.priority) ? 'all' : (filters.priority ?? 'all')
  const selectedTypeFilter = Array.isArray(filters.task_type) ? 'all' : (filters.task_type ?? 'all')

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Header: view toggle, search, filters, New Task */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              effectiveViewMode === 'list'
                ? 'bg-[#06B6D4] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={`hidden rounded-lg px-3 py-1.5 text-sm font-medium transition-colors md:inline-flex ${
              viewMode === 'board'
                ? 'bg-[#06B6D4] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Board
          </button>
        </div>
        <input
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 sm:max-w-xs"
        />
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className={`rounded-xl border px-3 py-2 text-sm font-medium flex items-center gap-1.5 ${
            filtersOpen
              ? 'border-[#06B6D4] bg-cyan-50 text-[#06B6D4]'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </button>
        {canManageTasks && (
          <button
            type="button"
            onClick={() => {
              setCreateModalDefaultStatus(null)
              setSelectedTaskId(CREATE_TASK_SENTINEL)
            }}
            className="w-full rounded-xl bg-[#06B6D4] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0891b2] sm:ml-auto sm:w-auto"
          >
            + Add Task
          </button>
        )}
      </div>

      {/* Collapsible filters */}
      {filtersOpen && (
        <div className="mt-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={() =>
              setFilters((f) => ({ ...f, mine_only: !(f.mine_only ?? false) }))
            }
            aria-pressed={filters.mine_only ?? false}
            className={`h-9 rounded-lg border px-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 cursor-pointer ${
              filters.mine_only
                ? 'border-[#06B6D4] bg-[#06B6D4]/10 text-[#0891b2]'
                : 'border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-slate-300 focus:border-[#06B6D4]'
            }`}
          >
            Assigned me
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-600">Status</span>
            <FilterDropdown
              value={selectedStatusFilter}
              ariaLabel="Filter by status"
              options={[
                { value: 'all', label: 'All' },
                ...TASK_STATUSES.map((status) => ({ value: status, label: TASK_STATUS_LABELS[status] })),
              ]}
              onChange={(value) =>
                setFilters((f) => ({
                  ...f,
                  status: value === 'all' ? 'all' : (value as TaskStatus),
                }))
              }
              renderIcon={(value) =>
                value === 'all'
                  ? null
                  : <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT_COLORS[value as TaskStatus] ?? 'bg-slate-400'}`} />
              }
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-600">Priority</span>
            <FilterDropdown
              value={selectedPriorityFilter}
              ariaLabel="Filter by priority"
              options={[
                { value: 'all', label: 'All' },
                ...(['urgent', 'high', 'medium', 'low'] as const).map((priority) => ({
                  value: priority,
                  label: TASK_PRIORITY_LABELS[priority],
                })),
              ]}
              onChange={(value) =>
                setFilters((f) => ({
                  ...f,
                  priority: value === 'all' ? 'all' : (value as TaskPriority),
                }))
              }
              renderIcon={(value) =>
                value === 'all'
                  ? null
                  : <PriorityFlagIcon className={`h-4 w-4 flex-shrink-0 ${TASK_PRIORITY_FLAG_COLORS[value as TaskPriority]}`} />
              }
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-600">Type</span>
            <FilterDropdown
              value={selectedTypeFilter}
              ariaLabel="Filter by type"
              options={[
                { value: 'all', label: 'All' },
                ...(['feature', 'bug', 'improvement', 'research', 'other'] as const).map((type) => ({
                  value: type,
                  label: TASK_TYPE_LABELS[type],
                })),
              ]}
              onChange={(value) =>
                setFilters((f) => ({
                  ...f,
                  task_type: value === 'all' ? 'all' : (value as TaskType),
                }))
              }
              renderIcon={(value) =>
                value === 'all'
                  ? null
                  : <TaskTypeIcon type={value as TaskType} className="h-4 w-4 flex-shrink-0 text-slate-500" />
              }
            />
          </div>
        </div>
      )}

      {/* Main content: list or board; task detail opens in modal overlay */}
      <div className="flex-1 min-h-0 flex flex-col mt-2 overflow-hidden">
        <div className={`flex-1 min-h-0 min-w-0 ${effectiveViewMode === 'board' ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
          {loading ? (
            <div className="px-0.5 py-2 space-y-3">
              {[1, 2, 3].map((section) => (
                <div key={section} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50/80">
                    <span className="h-5 w-5 rounded bg-slate-200 animate-pulse" />
                    <span className="h-6 w-20 rounded-full bg-slate-200 animate-pulse" />
                    <span className="h-4 w-6 rounded bg-slate-200 animate-pulse" />
                  </div>
                  <table className="w-full min-w-[720px] table-fixed text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="px-3 py-2 min-w-[200px] w-[50%]">Name</th>
                        <th className="px-3 py-2 w-[92px] shrink-0">Status</th>
                        <th className="px-3 py-2 w-[88px] shrink-0">Assignee</th>
                        <th className="px-3 py-2 w-[88px] shrink-0">Due date</th>
                        <th className="px-3 py-2 w-[78px] shrink-0">Priority</th>
                        <th className="px-3 py-2 w-9 shrink-0" />
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4].map((row) => (
                        <tr key={row} className="border-b border-slate-100">
                          <td className="px-3 py-2">
                            <span className="block h-4 rounded bg-slate-200 animate-pulse w-full max-w-[280px]" />
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-block h-6 w-16 rounded-md bg-slate-200 animate-pulse" />
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex h-7 w-7 rounded-full bg-slate-200 animate-pulse" />
                          </td>
                          <td className="px-3 py-2">
                            <span className="block h-4 w-20 rounded bg-slate-200 animate-pulse" />
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-block h-5 w-14 rounded bg-slate-200 animate-pulse" />
                          </td>
                          <td className="px-3 py-2">
                            <span className="h-8 w-8 rounded bg-slate-200 animate-pulse" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : effectiveViewMode === 'list' ? (
            <div
              className={`px-0.5 py-2 ${tasks.length === 0 ? 'flex-1 min-h-0 flex items-center justify-center' : 'space-y-3'}`}
            >
              {tasks.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No tasks"
                    description="Create a task or adjust filters."
                  />
                </div>
              ) : (
                TASK_STATUSES.map((status) => {
                  const sectionTasks = tasksByStatus[status]
                  if (sectionTasks.length === 0) return null
                  const isCollapsed = sectionCollapsed[status]
                  return (
                    <div key={status} className="rounded-xl border border-slate-200 bg-white">
                      {/* Section header: expand, status pill + count, ellipsis, + Add Task */}
                      <div className={`flex items-center gap-2 px-3 py-2 border-b border-slate-200 rounded-t-xl ${isCollapsed ? 'rounded-b-xl' : ''} ${TASK_STATUS_HEADER_BG[status]}`}>
                        <button
                          type="button"
                          onClick={() =>
                            setSectionCollapsed((prev) => ({ ...prev, [status]: !prev[status] }))
                          }
                          className="p-1 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                          aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                        >
                          <svg
                            className={`h-5 w-5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${TASK_STATUS_STYLES[status]}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${TASK_STATUS_DOT_COLORS[status]}`} />
                          {TASK_STATUS_LABELS[status].toUpperCase()}
                        </span>
                        <span className="text-sm text-slate-500">{sectionTasks.length}</span>
                        <div className="flex-1" />
                        {canManageTasks && (
                          <button
                            type="button"
                            onClick={() => {
                              setCreateModalDefaultStatus(status)
                              setSelectedTaskId(CREATE_TASK_SENTINEL)
                            }}
                            className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
                          >
                            + Add Task
                          </button>
                        )}
                      </div>
                      {!isCollapsed && (
                        <>
                          {/* Mobile list mode: card layout per task */}
                          <div className="space-y-2 p-2.5 md:hidden">
                            {sectionTasks.map((task) => (
                              <TaskBoardCard
                                key={task.id}
                                task={task}
                                canEditTask={canEditTask}
                                canUpdateStatus={canUpdateStatus}
                                canDrag={false}
                                isDragging={false}
                                showStatusControl={true}
                                onOpenTask={() => setSelectedTaskId(task.id)}
                                onDragStart={() => {}}
                                onDragEnd={() => {}}
                                onStatusChange={handleStatusChange}
                                onAssigneesChange={handleAssigneesChange}
                                onDueDateChange={handleDueDateChange}
                                onPriorityChange={handlePriorityChange}
                                onRequestDelete={() => setDeleteConfirmTaskId(task.id)}
                                assignableUsers={assignableUsers}
                                getAssigneeColor={getAssigneeColor}
                                staffInitials={staffInitials}
                                staffLabel={staffLabel}
                              />
                            ))}
                          </div>

                          {/* Desktop list mode: keep existing table */}
                          <div className="hidden min-w-0 overflow-x-auto overflow-y-hidden rounded-b-xl md:block">
                            <table className="w-full min-w-[720px] table-fixed text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                  <th className="px-3 py-2 min-w-[200px] w-[50%]">Name</th>
                                  <th className="px-3 py-2 w-[92px] shrink-0">Status</th>
                                  <th className="px-3 py-2 w-[88px] shrink-0">Assignee</th>
                                  <th className="px-3 py-2 w-[88px] shrink-0">Due date</th>
                                  <th className="px-3 py-2 w-[78px] shrink-0">Priority</th>
                                  <th className="px-3 py-2 w-9 shrink-0">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sectionTasks.map((task) => (
                                  <TaskListRow
                                    key={task.id}
                                    task={task}
                                    assignableUsers={assignableUsers}
                                    canEditTask={canEditTask}
                                    canUpdateStatus={canUpdateStatus}
                                    onOpenTask={() => setSelectedTaskId(task.id)}
                                    onStatusChange={handleStatusChange}
                                    onAssigneesChange={handleAssigneesChange}
                                    onDueDateChange={handleDueDateChange}
                                    onPriorityChange={handlePriorityChange}
                                    onRequestDelete={() => setDeleteConfirmTaskId(task.id)}
                                    getAssigneeColor={getAssigneeColor}
                                    staffInitials={staffInitials}
                                    staffLabel={staffLabel}
                                  />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <div className="h-full min-h-[420px] overflow-x-auto overflow-y-hidden px-0.5 py-2 scrollbar-hide">
              <div className="grid h-full min-w-[980px] grid-cols-5 gap-3 lg:min-w-0">
                {TASK_STATUSES.map((status) => {
                  const statusTasks = tasksByStatus[status]
                  const isDragOverColumn =
                    boardDragState !== null &&
                    boardDragOverStatus === status &&
                    boardDragState.fromStatus !== status
                  return (
                    <section
                      key={status}
                      onDragOver={(event) => handleBoardColumnDragOver(status, event)}
                      onDrop={(event) => { void handleBoardColumnDrop(status, event) }}
                      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border transition-colors ${
                        TASK_BOARD_COLUMN_STYLES[status]
                      } ${isDragOverColumn ? 'border-cyan-300 ring-2 ring-cyan-200/80 ring-inset' : ''}`}
                    >
                      <div className={`flex items-center justify-between gap-2 border-b border-white/70 px-3 py-2 ${TASK_BOARD_HEADER_STYLES[status]}`}>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TASK_STATUS_DOT_COLORS[status]}`} />
                          <span className="truncate text-sm font-semibold text-slate-700">
                            {TASK_STATUS_LABELS[status]}
                          </span>
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200/70 px-1.5 text-[11px] font-semibold text-slate-600">
                            {statusTasks.length}
                          </span>
                        </div>
                        {canManageTasks && (
                          <button
                            type="button"
                            onClick={() => {
                              setCreateModalDefaultStatus(status)
                              setSelectedTaskId(CREATE_TASK_SENTINEL)
                            }}
                            className="inline-flex h-7 items-center rounded-lg border border-cyan-200 bg-white/95 px-2.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-50"
                          >
                            + Task
                          </button>
                        )}
                      </div>
                      <div className="flex-1 space-y-3 overflow-y-auto p-2">
                        {statusTasks.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300/80 bg-white/70 px-3 py-7 text-center">
                            <p className="text-xs font-medium text-slate-500">
                              No tasks in {TASK_STATUS_LABELS[status]}.
                            </p>
                            {canManageTasks && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCreateModalDefaultStatus(status)
                                  setSelectedTaskId(CREATE_TASK_SENTINEL)
                                }}
                                className="mt-2 text-xs font-semibold text-cyan-700 hover:text-cyan-800"
                              >
                                Add the first task
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {statusTasks.map((task) => (
                              <TaskBoardCard
                                key={task.id}
                                task={task}
                                canEditTask={canEditTask}
                                canDrag={canUpdateStatus}
                                isDragging={boardDragState?.taskId === task.id}
                                onOpenTask={() => setSelectedTaskId(task.id)}
                                onDragStart={handleBoardDragStart}
                                onDragEnd={handleBoardDragEnd}
                                onAssigneesChange={handleAssigneesChange}
                                onDueDateChange={handleDueDateChange}
                                onPriorityChange={handlePriorityChange}
                                onRequestDelete={() => setDeleteConfirmTaskId(task.id)}
                                assignableUsers={assignableUsers}
                                getAssigneeColor={getAssigneeColor}
                                staffInitials={staffInitials}
                                staffLabel={staffLabel}
                              />
                            ))}
                            {canManageTasks && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCreateModalDefaultStatus(status)
                                  setSelectedTaskId(CREATE_TASK_SENTINEL)
                                }}
                                className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-50"
                              >
                                + Add Task
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Task detail: full panel (view/edit or create mode) */}
        {selectedTaskId && (
          <TaskDetailPanel
            taskId={selectedTaskId}
            taskDetail={taskDetail}
            detailLoading={detailLoading}
            isCreateMode={selectedTaskId === CREATE_TASK_SENTINEL}
            defaultStatus={createModalDefaultStatus ?? undefined}
            projectId={projectId}
            onClose={() => { setSelectedTaskId(null); setCreateModalDefaultStatus(null) }}
            onCreateTask={handleCreateTask}
            userRole={userRole}
            canEditTask={canEditTask}
            canUpdateStatus={canUpdateStatus}
            canManageAttachments={canManageAttachments}
            currentUserId={currentUserId}
            assignableUsers={assignableUsers}
            mentionableUsers={mentionableUsers}
            onStatusChange={handleStatusChange}
            onUpdateTask={handleUpdateTask}
            onRequestDelete={() => selectedTaskId !== CREATE_TASK_SENTINEL && setDeleteConfirmTaskId(selectedTaskId)}
            onAssigneesChange={handleAssigneesChange}
            onAddComment={handleAddComment}
            onUpdateComment={handleUpdateComment}
            onDeleteComment={handleDeleteComment}
            onDeleteCommentAttachment={handleDeleteCommentAttachment}
            onUploadAttachments={handleUploadAttachments}
            onRemoveAttachment={handleRemoveAttachment}
            onTaskDeleted={() => setSelectedTaskId(null)}
            showError={showError}
            showSuccess={showSuccess}
            getAssigneeColor={getAssigneeColor}
            staffInitials={staffInitials}
            staffLabel={staffLabel}
          />
        )}
      </div>

      {/* Delete confirm */}
      {deleteConfirmTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900">Delete task?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-900">"{deleteConfirmTaskTitle ?? 'this task'}"</span>? This action cannot be undone.
            </p>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmTaskId(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTask(deleteConfirmTaskId)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function staffLabel(o: StaffSelectOption) {
  return getUserTagLabel(o)
}

function staffInitials(o: StaffSelectOption) {
  return getInitials(getUserName(o))
}

/** Stable color palette for assignee avatars; same id => same color in dropdown and tags. */
const ASSIGNEE_AVATAR_COLORS = [
  { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  { bg: 'bg-violet-100', text: 'text-violet-800' },
  { bg: 'bg-rose-100', text: 'text-rose-800' },
  { bg: 'bg-sky-100', text: 'text-sky-800' },
  { bg: 'bg-teal-100', text: 'text-teal-800' },
  { bg: 'bg-orange-100', text: 'text-orange-800' },
] as const

function getAssigneeColor(id: string) {
  let n = 0
  for (let i = 0; i < id.length; i++) n = (n << 5) - n + id.charCodeAt(i)
  return ASSIGNEE_AVATAR_COLORS[Math.abs(n) % ASSIGNEE_AVATAR_COLORS.length]
}

/** Searchable assignee dropdown: profile icon + name in list; selected as icon-only tags, hover shows name + remove. */
function AssigneeSearchSelect({
  value,
  options,
  onChange,
  placeholder = 'Search assignees…',
}: {
  value: string[]
  options: StaffSelectOption[]
  onChange: (ids: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredTag, setHoveredTag] = useState<{ id: string; el: HTMLElement } | null>(null)
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const showTagHover = (id: string, el: HTMLElement) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoveredTag({ id, el })
  }
  const hideTagHover = () => {
    hoverTimeoutRef.current = setTimeout(() => setHoveredTag(null), 120)
  }
  const clearTagHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }

  // Keep tooltip position in sync with anchor (scroll/resize) and when hovered tag changes
  useEffect(() => {
    if (!hoveredTag?.el) {
      setTooltipRect(null)
      return
    }
    const update = () => setTooltipRect(hoveredTag.el.getBoundingClientRect())
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [hoveredTag])

  const q = searchQuery.trim().toLowerCase()
  const filtered =
    q === ''
      ? options
      : options.filter(
          (o) =>
            (o.full_name ?? '').toLowerCase().includes(q) || (o.email ?? '').toLowerCase().includes(q)
        )
  const selectedOptions = options.filter((o) => value.includes(o.id))

  // Close when clicking outside; clicking the combobox itself toggles (handled below)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // When dropdown opens, focus the search input so user can type immediately
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id))
    else onChange([...value, id])
  }

  const remove = (id: string) => onChange(value.filter((x) => x !== id))

  return (
    <div ref={ref} className="relative">
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
        className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#06B6D4]/20 focus-within:border-[#06B6D4] transition-colors duration-200 cursor-pointer"
      >
        <div className="flex flex-wrap items-center gap-2">
          {selectedOptions.map((o) => {
            const color = getAssigneeColor(o.id)
            const showTooltip = hoveredTag?.id === o.id
            return (
              <span
                key={o.id}
                className="relative inline-flex cursor-default"
                onMouseEnter={(e) => showTagHover(o.id, e.currentTarget)}
                onMouseLeave={hideTagHover}
              >
                {/* Profile icon with remove badge on top-right */}
                <span
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${color.bg} ${color.text} ring-2 ring-white shadow-sm transition-transform duration-200 hover:scale-110 ${showTooltip ? 'scale-110' : ''}`}
                >
                  {staffInitials(o)}
                  {/* Remove: small dark circle with X at top-right of avatar, visible only on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      remove(o.id)
                      setHoveredTag(null)
                    }}
                    className={`absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 cursor-pointer transition-opacity duration-200 ${showTooltip ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                    aria-label={`Remove ${staffLabel(o)}`}
                  >
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              </span>
            )
          })}
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={selectedOptions.length === 0 ? placeholder : 'Search…'}
            className="flex-1 min-w-[120px] py-1 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none bg-transparent cursor-pointer"
            aria-autocomplete="list"
            aria-controls={listboxId}
          />
        </div>
      </div>
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute top-full left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">No matches</li>
          ) : (
            filtered.map((o) => {
              const isSelected = value.includes(o.id)
              const color = getAssigneeColor(o.id)
              return (
                <li key={o.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => toggle(o.id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors duration-150 ${
                      isSelected ? 'bg-slate-50/80' : ''
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${color.bg} ${color.text}`}
                    >
                      {staffInitials(o)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">{staffLabel(o)}</div>
                      {o.email && (
                        <div className="text-xs text-slate-500 truncate">{o.email}</div>
                      )}
                    </div>
                    {isSelected && (
                      <svg className="h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
      {/* Tooltip in portal so it is never clipped by modal overflow; fixed positioning on top layer */}
      {typeof document !== 'undefined' &&
        hoveredTag &&
        tooltipRect &&
        createPortal(
          (() => {
            const option = selectedOptions.find((o) => o.id === hoveredTag.id)
            const label = option ? staffLabel(option) : ''
            const centerX = tooltipRect.left + tooltipRect.width / 2
            const top = tooltipRect.top - 8
            return (
              <div
                className="fixed z-[9999] pointer-events-none"
                style={{
                  left: centerX,
                  top,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className="rounded-lg bg-slate-800 px-3 py-2 shadow-xl whitespace-nowrap">
                  <span className="text-sm font-medium text-white">{label}</span>
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-800"
                    aria-hidden
                  />
                </div>
              </div>
            )
          })(),
          document.body
        )}
    </div>
  )
}

function TaskBoardCard({
  task,
  canEditTask,
  canUpdateStatus = false,
  canDrag,
  isDragging,
  showStatusControl = false,
  onOpenTask,
  onDragStart,
  onDragEnd,
  onStatusChange,
  onAssigneesChange,
  onDueDateChange,
  onPriorityChange,
  onRequestDelete,
  assignableUsers,
  getAssigneeColor,
  staffInitials,
  staffLabel,
}: {
  task: ProjectTaskListItem
  canEditTask: boolean
  canUpdateStatus?: boolean
  canDrag: boolean
  isDragging: boolean
  showStatusControl?: boolean
  onOpenTask: () => void
  onDragStart: (taskId: string, status: TaskStatus, event: React.DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onStatusChange?: (taskId: string, status: TaskStatus) => void
  onAssigneesChange: (taskId: string, assigneeIds: string[]) => void
  onDueDateChange: (taskId: string, dueDate: string | null) => void
  onPriorityChange: (taskId: string, priority: TaskPriority | null) => void
  onRequestDelete: () => void
  assignableUsers: StaffSelectOption[]
  getAssigneeColor: (id: string) => { bg: string; text: string }
  staffInitials: (o: StaffSelectOption) => string
  staffLabel: (o: StaffSelectOption) => string
}) {
  const [openDropdown, setOpenDropdown] = useState<'status' | 'assignee' | 'priority' | null>(null)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; right?: number } | null>(null)
  const cardRef = useRef<HTMLElement>(null)
  const suppressOpenRef = useRef(false)
  const statusBtnRef = useRef<HTMLButtonElement>(null)
  const assigneeBtnRef = useRef<HTMLButtonElement>(null)
  const dueInputRef = useRef<HTMLInputElement>(null)
  const priorityBtnRef = useRef<HTMLButtonElement>(null)
  const assigneeIds = task.assignees.map((assignee) => assignee.id)

  const getTriggerRect = () => {
    const ref =
      openDropdown === 'status'
        ? statusBtnRef
        : openDropdown === 'assignee'
          ? assigneeBtnRef
          : priorityBtnRef
    return ref.current?.getBoundingClientRect() ?? null
  }

  useEffect(() => {
    if (!openDropdown) {
      setDropdownRect(null)
      return
    }
    const update = () => {
      const rect = getTriggerRect()
      if (rect) setDropdownRect({ top: rect.bottom + 4, left: rect.left, right: rect.right })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [openDropdown])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!openDropdown) return
      const target = event.target as Node
      if (cardRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-board-card-dropdown]')) return
      setOpenDropdown(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openDropdown])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openDropdown) setOpenDropdown(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openDropdown])

  const descriptionPreview = getTaskDescriptionPreview(task.description_html)
  const dueMeta = getTaskDueDateMeta(task.due_date)
  const assigneeOptions = task.assignees
    .map((a) => assignableUsers.find((m) => m.id === a.id) ?? { id: a.id, full_name: a.full_name, email: a.email, role: a.role })
    .filter(Boolean) as StaffSelectOption[]
  const assigneeNamesTooltip = assigneeOptions.length > 0 ? assigneeOptions.map((option) => staffLabel(option)).join(', ') : 'No assignees'
  const primaryAssignee = assigneeOptions[0] ?? null
  const extraCount = Math.max(assigneeOptions.length - 1, 0)
  const extraAssigneesTooltip = extraCount > 0 ? assigneeOptions.slice(1).map((option) => staffLabel(option)).join(', ') : ''

  return (
    <article
      ref={cardRef}
      role="button"
      tabIndex={0}
      draggable={canDrag}
      onDragStart={(event) => {
        if (!canDrag) {
          event.preventDefault()
          return
        }
        suppressOpenRef.current = true
        onDragStart(task.id, task.status, event)
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          suppressOpenRef.current = false
        }, 0)
        onDragEnd()
      }}
      onClick={() => {
        if (suppressOpenRef.current) return
        onOpenTask()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenTask()
        }
      }}
      className={`group rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'scale-[0.99] opacity-75' : ''}`}
    >
      <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 transition-colors duration-150 group-hover:text-cyan-700">
        {task.title}
      </h4>

      {descriptionPreview && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h10M4 17h8" />
          </svg>
          <span className="line-clamp-1">{descriptionPreview}</span>
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3 space-y-2" onClick={(event) => event.stopPropagation()}>
        <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
          {showStatusControl ? (
            canUpdateStatus && onStatusChange ? (
              <div className="relative inline-block">
                <button
                  ref={statusBtnRef}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpenDropdown((open) => (open === 'status' ? null : 'status')) }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
                  title="Change status"
                >
                  <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT_COLORS[task.status] ?? 'bg-slate-400'}`} />
                  <span>{TASK_STATUS_LABELS[task.status] ?? task.status}</span>
                </button>
                {openDropdown === 'status' && dropdownRect && typeof document !== 'undefined' &&
                  createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setOpenDropdown(null)} />
                      <div
                        data-board-card-dropdown
                        className="fixed z-[9999] w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1"
                        style={{ top: dropdownRect.top, left: dropdownRect.left }}
                      >
                        {TASK_STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => {
                              onStatusChange(task.id, status)
                              setOpenDropdown(null)
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${task.status === status ? 'bg-cyan-50/80' : ''}`}
                          >
                            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${TASK_STATUS_DOT_COLORS[status] ?? 'bg-slate-400'}`} />
                            <span>{TASK_STATUS_LABELS[status] ?? status}</span>
                          </button>
                        ))}
                      </div>
                    </>,
                    document.body
                  )}
              </div>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT_COLORS[task.status] ?? 'bg-slate-400'}`} />
                <span>{TASK_STATUS_LABELS[task.status] ?? task.status}</span>
              </span>
            )
          ) : null}

          {canEditTask ? (
            <div className="relative inline-block">
              <button
                ref={assigneeBtnRef}
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpenDropdown((open) => (open === 'assignee' ? null : 'assignee')) }}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-0.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
                title={assigneeOptions.length === 0 ? 'Change assignee' : assigneeNamesTooltip}
              >
                {primaryAssignee ? (
                  <>
                    <span
                      title={staffLabel(primaryAssignee)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${getAssigneeColor(primaryAssignee.id).bg} ${getAssigneeColor(primaryAssignee.id).text}`}
                    >
                      {staffInitials(primaryAssignee)}
                    </span>
                    {extraCount > 0 && (
                      <span title={extraAssigneesTooltip} className="text-[11px] font-medium text-slate-600">
                        +{extraCount}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                )}
              </button>
              {openDropdown === 'assignee' && dropdownRect && typeof document !== 'undefined' &&
                createPortal(
                  <>
                    <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setOpenDropdown(null)} />
                    <div
                      data-board-card-dropdown
                      className="fixed z-[9999] w-56 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl py-1"
                      style={{ top: dropdownRect.top, left: dropdownRect.left }}
                    >
                      {assignableUsers.map((option) => {
                        const isSelected = assigneeIds.includes(option.id)
                        const color = getAssigneeColor(option.id)
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              onAssigneesChange(task.id, isSelected ? assigneeIds.filter((id) => id !== option.id) : [...assigneeIds, option.id])
                              setOpenDropdown(null)
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 ${isSelected ? 'bg-cyan-50/80' : ''}`}
                          >
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color.bg} ${color.text}`}>
                              {staffInitials(option)}
                            </span>
                            <span className="text-sm truncate">{staffLabel(option)}</span>
                            {isSelected && (
                              <svg className="h-4 w-4 ml-auto text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </>,
                  document.body
                )}
            </div>
          ) : primaryAssignee ? (
            <span
              title={staffLabel(primaryAssignee)}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${getAssigneeColor(primaryAssignee.id).bg} ${getAssigneeColor(primaryAssignee.id).text}`}
            >
              {staffInitials(primaryAssignee)}
            </span>
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
          )}

          <div className="relative inline-block">
            <input
              ref={dueInputRef}
              type="date"
              value={task.due_date ?? ''}
              onChange={(e) => onDueDateChange(task.id, e.target.value || null)}
              className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer pointer-events-none"
              aria-hidden
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (canEditTask && dueInputRef.current) {
                  try {
                    dueInputRef.current.showPicker?.()
                  } catch {
                    dueInputRef.current.focus()
                  }
                }
              }}
              disabled={!canEditTask}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${dueMeta.className} ${
                canEditTask ? 'hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30' : ''
              }`}
              title="Select due date"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {dueMeta.label}
            </button>
          </div>

          {canEditTask ? (
            <div className="relative inline-block">
              <button
                ref={priorityBtnRef}
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpenDropdown((open) => (open === 'priority' ? null : 'priority')) }}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 ${
                  task.priority
                    ? `border-slate-200/80 ${TASK_PRIORITY_STYLES[task.priority]}`
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
                title="Change priority"
              >
                <PriorityFlagIcon className={`h-3.5 w-3.5 flex-shrink-0 ${task.priority ? TASK_PRIORITY_FLAG_COLORS[task.priority] : 'text-slate-400'}`} />
                <span>{task.priority ? TASK_PRIORITY_LABELS[task.priority] : 'Priority'}</span>
              </button>
              {openDropdown === 'priority' && dropdownRect && typeof document !== 'undefined' &&
                createPortal(
                  <>
                    <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setOpenDropdown(null)} />
                    <div
                      data-board-card-dropdown
                      className="fixed z-[9999] w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1"
                      style={{ top: dropdownRect.top, left: dropdownRect.left }}
                    >
                      {TASK_PRIORITIES.map((priority) => (
                        <button
                          key={priority}
                          type="button"
                          onClick={() => {
                            onPriorityChange(task.id, priority)
                            setOpenDropdown(null)
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-sky-50 ${task.priority === priority ? 'bg-sky-50' : ''}`}
                        >
                          <PriorityFlagIcon className={`h-4 w-4 flex-shrink-0 ${TASK_PRIORITY_FLAG_COLORS[priority]}`} />
                          <span>{TASK_PRIORITY_LABELS[priority]}</span>
                        </button>
                      ))}
                    </div>
                  </>,
                  document.body
                )}
            </div>
          ) : task.priority ? (
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TASK_PRIORITY_STYLES[task.priority]}`}>
              <PriorityFlagIcon className={`h-3.5 w-3.5 ${TASK_PRIORITY_FLAG_COLORS[task.priority]}`} />
              {TASK_PRIORITY_LABELS[task.priority]}
            </span>
          ) : null}

          {canEditTask && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRequestDelete() }}
              className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              aria-label="Delete task"
              title="Delete task"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V6" />
              </svg>
            </button>
          )}
        </div>

      </div>
    </article>
  )
}

function TaskListRow({
  task,
  assignableUsers,
  canEditTask,
  canUpdateStatus,
  onOpenTask,
  onStatusChange,
  onAssigneesChange,
  onDueDateChange,
  onPriorityChange,
  onRequestDelete,
  getAssigneeColor,
  staffInitials,
  staffLabel,
}: {
  task: ProjectTaskListItem
  assignableUsers: StaffSelectOption[]
  canEditTask: boolean
  canUpdateStatus: boolean
  onOpenTask: () => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onAssigneesChange: (taskId: string, assigneeIds: string[]) => void
  onDueDateChange: (taskId: string, dueDate: string | null) => void
  onPriorityChange: (taskId: string, priority: TaskPriority | null) => void
  onRequestDelete: () => void
  getAssigneeColor: (id: string) => { bg: string; text: string }
  staffInitials: (o: StaffSelectOption) => string
  staffLabel: (o: StaffSelectOption) => string
}) {
  const [openDropdown, setOpenDropdown] = useState<'status' | 'assignee' | 'priority' | null>(null)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; right?: number } | null>(null)
  const rowRef = useRef<HTMLTableRowElement>(null)
  const statusBtnRef = useRef<HTMLButtonElement>(null)
  const assigneeBtnRef = useRef<HTMLButtonElement>(null)
  const dueInputRef = useRef<HTMLInputElement>(null)
  const priorityBtnRef = useRef<HTMLButtonElement>(null)
  const assigneeIds = task.assignees.map((a) => a.id)

  const getTriggerRect = () => {
    const ref =
      openDropdown === 'status'
        ? statusBtnRef
        : openDropdown === 'assignee'
          ? assigneeBtnRef
          : priorityBtnRef
    return ref.current?.getBoundingClientRect() ?? null
  }

  useEffect(() => {
    if (!openDropdown) {
      setDropdownRect(null)
      return
    }
    const update = () => {
      const rect = getTriggerRect()
      if (rect) setDropdownRect({ top: rect.bottom + 4, left: rect.left, right: rect.right })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [openDropdown])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!openDropdown) return
      const target = e.target as Node
      if (rowRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-list-view-dropdown]')) return
      setOpenDropdown(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openDropdown])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openDropdown) setOpenDropdown(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openDropdown])

  const assigneeOptions = task.assignees
    .map((a) => assignableUsers.find((m) => m.id === a.id) ?? { id: a.id, full_name: a.full_name, email: a.email, role: a.role })
    .filter(Boolean) as StaffSelectOption[]
  const assigneeNamesTooltip = assigneeOptions.length > 0 ? assigneeOptions.map((o) => staffLabel(o)).join(', ') : 'No assignees'
  const maxAvatars = 3
  const assigneesToShow = assigneeOptions.slice(0, maxAvatars)
  const extraCount = assigneeOptions.length - maxAvatars
  const extraAssigneesTooltip = extraCount > 0 ? assigneeOptions.slice(maxAvatars).map((o) => staffLabel(o)).join(', ') : ''

  return (
    <tr
      ref={rowRef}
      role="button"
      tabIndex={0}
      onClick={() => onOpenTask()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenTask() } }}
      className="border-b border-slate-100 hover:bg-slate-50/80 group cursor-pointer"
    >
      <td className="px-3 py-2 min-w-0">
        <span className="text-left font-medium text-slate-900 group-hover:text-[#06B6D4] block w-full break-words" title={task.title}>
          {task.title}
        </span>
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {canUpdateStatus ? (
          <div className="relative inline-block">
            <button
              ref={statusBtnRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenDropdown((o) => (o === 'status' ? null : 'status')) }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
              title="Change status"
            >
              <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT_COLORS[task.status] ?? 'bg-slate-400'}`} />
              <span>{TASK_STATUS_LABELS[task.status] ?? task.status}</span>
            </button>
            {openDropdown === 'status' && dropdownRect && typeof document !== 'undefined' &&
              createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setOpenDropdown(null)} />
                  <div
                    data-list-view-dropdown
                    className="fixed z-[9999] w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1"
                    style={{ top: dropdownRect.top, left: dropdownRect.left }}
                  >
                    {TASK_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { onStatusChange(task.id, s); setOpenDropdown(null) }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${TASK_STATUS_DOT_COLORS[s] ?? 'bg-slate-400'}`} />
                        <span>{TASK_STATUS_LABELS[s] ?? s}</span>
                      </button>
                    ))}
                  </div>
                </>,
                document.body
              )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT_COLORS[task.status] ?? 'bg-slate-400'}`} />
            {TASK_STATUS_LABELS[task.status] ?? task.status}
          </span>
        )}
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {canEditTask ? (
          <div className="relative inline-block">
            <button
              ref={assigneeBtnRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenDropdown((o) => (o === 'assignee' ? null : 'assignee')) }}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
              title={assigneeOptions.length === 0 ? 'Change assignee' : assigneeNamesTooltip}
            >
              {assigneeOptions.length > 0 ? (
                <span className="flex items-center -space-x-2">
                  {assigneesToShow.map((m) => (
                    <span
                      key={m.id}
                      title={staffLabel(m)}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-semibold ring-1 ring-slate-200 ${getAssigneeColor(m.id).bg} ${getAssigneeColor(m.id).text}`}
                    >
                      {staffInitials(m)}
                    </span>
                  ))}
                  {extraCount > 0 && (
                    <span
                      title={extraAssigneesTooltip}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                    >
                      +{extraCount}
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
              )}
            </button>
            {openDropdown === 'assignee' && dropdownRect && typeof document !== 'undefined' &&
              createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setOpenDropdown(null)} />
                  <div
                    data-list-view-dropdown
                    className="fixed z-[9999] w-56 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl py-1"
                    style={{ top: dropdownRect.top, left: dropdownRect.left }}
                  >
                    {assignableUsers.map((m) => {
                      const isSelected = assigneeIds.includes(m.id)
                      const color = getAssigneeColor(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onAssigneesChange(task.id, isSelected ? assigneeIds.filter((id) => id !== m.id) : [...assigneeIds, m.id])
                            setOpenDropdown(null)
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 ${isSelected ? 'bg-cyan-50/80' : ''}`}
                        >
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color.bg} ${color.text}`}>
                            {staffInitials(m)}
                          </span>
                          <span className="text-sm truncate">{staffLabel(m)}</span>
                          {isSelected && (
                            <svg className="h-4 w-4 ml-auto text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>,
                document.body
              )}
          </div>
        ) : assigneeOptions.length > 0 ? (
          <span className="inline-flex items-center -space-x-2">
            {assigneesToShow.map((m) => (
              <span
                key={m.id}
                title={staffLabel(m)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-semibold ring-1 ring-slate-200 ${getAssigneeColor(m.id).bg} ${getAssigneeColor(m.id).text}`}
              >
                {staffInitials(m)}
              </span>
            ))}
            {extraCount > 0 && (
              <span
                title={extraAssigneesTooltip}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
              >
                +{extraCount}
              </span>
            )}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {canEditTask ? (
          <div className="relative inline-block">
            <input
              ref={dueInputRef}
              type="date"
              value={task.due_date ?? ''}
              onChange={(e) => onDueDateChange(task.id, e.target.value || null)}
              className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer pointer-events-none"
              aria-hidden
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (dueInputRef.current) {
                  try {
                    dueInputRef.current.showPicker?.()
                  } catch {
                    dueInputRef.current.focus()
                  }
                }
              }}
              className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
              title="Select due date"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {task.due_date ? formatDate(task.due_date) : '—'}
            </button>
          </div>
        ) : (
          <span className="text-slate-600 text-xs">{task.due_date ? formatDate(task.due_date) : '—'}</span>
        )}
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {canEditTask ? (
          <div className="relative inline-block">
            <button
              ref={priorityBtnRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenDropdown((o) => (o === 'priority' ? null : 'priority')) }}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 ${
                task.priority
                  ? `border-slate-200/80 ${TASK_PRIORITY_STYLES[task.priority]}`
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
              title="Change priority"
            >
              <PriorityFlagIcon className={`h-4 w-4 flex-shrink-0 ${task.priority ? TASK_PRIORITY_FLAG_COLORS[task.priority] : 'text-slate-400'}`} />
              <span>{task.priority ? TASK_PRIORITY_LABELS[task.priority] : '—'}</span>
            </button>
            {openDropdown === 'priority' && dropdownRect && typeof document !== 'undefined' &&
              createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setOpenDropdown(null)} />
                  <div
                    data-list-view-dropdown
                    className="fixed z-[9999] w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1"
                    style={{ top: dropdownRect.top, left: dropdownRect.left }}
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          onPriorityChange(task.id, p)
                          setOpenDropdown(null)
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-sky-50 ${task.priority === p ? 'bg-sky-50' : ''}`}
                      >
                        <PriorityFlagIcon className={`h-4 w-4 flex-shrink-0 ${TASK_PRIORITY_FLAG_COLORS[p]}`} />
                        <span>{TASK_PRIORITY_LABELS[p]}</span>
                      </button>
                    ))}
                  </div>
                </>,
                document.body
              )}
          </div>
        ) : (
          <span className={`inline-flex items-center gap-1.5 text-xs ${task.priority ? TASK_PRIORITY_STYLES[task.priority] : 'text-slate-400'}`}>
            {task.priority && <PriorityFlagIcon className={`h-4 w-4 ${TASK_PRIORITY_FLAG_COLORS[task.priority]}`} />}
            {task.priority ? TASK_PRIORITY_LABELS[task.priority] : '—'}
          </span>
        )}
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {canEditTask ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRequestDelete() }}
            className="p-1.5 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            aria-label="Delete task"
            title="Delete task"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
            </svg>
          </button>
        ) : (
          <span className="inline-block w-8" aria-hidden />
        )}
      </td>
    </tr>
  )
}

function TaskDetailPanel({
  taskId,
  taskDetail,
  detailLoading,
  isCreateMode = false,
  defaultStatus,
  projectId,
  onClose,
  onCreateTask,
  userRole,
  canEditTask,
  canUpdateStatus,
  canManageAttachments,
  currentUserId,
  assignableUsers,
  mentionableUsers,
  onStatusChange,
  onUpdateTask,
  onRequestDelete,
  onAssigneesChange,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onDeleteCommentAttachment,
  onUploadAttachments,
  onRemoveAttachment,
  onTaskDeleted,
  showError,
  showSuccess,
  getAssigneeColor,
  staffInitials,
  staffLabel,
}: {
  taskId: string
  taskDetail: ProjectTaskDetail | null
  detailLoading: boolean
  isCreateMode?: boolean
  defaultStatus?: TaskStatus
  projectId?: string
  onClose: () => void
  onCreateTask?: (p: {
    title: string
    description_html?: string | null
    task_type?: TaskType | null
    priority?: TaskPriority | null
    status?: TaskStatus | null
    due_date?: string | null
    assignee_ids?: string[]
    initial_files?: File[]
  }) => Promise<{ data?: ProjectTaskListItem | null }>
  userRole: string
  canEditTask: boolean
  canUpdateStatus: boolean
  canManageAttachments: boolean
  currentUserId: string | undefined
  assignableUsers: StaffSelectOption[]
  mentionableUsers: TaskAssignee[]
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onUpdateTask: (
    taskId: string,
    p: {
      title?: string
      description_html?: string | null
      task_type?: TaskType | null
      priority?: TaskPriority | null
      status?: TaskStatus | null
      due_date?: string | null
    }
  ) => Promise<unknown>
  onRequestDelete: () => void
  onAssigneesChange: (taskId: string, assigneeIds: string[]) => void
  onAddComment: (taskId: string, text: string, mentionIds: string[], files: File[]) => Promise<boolean>
  onUpdateComment: (taskId: string, commentId: string, text: string, mentionIds: string[]) => void
  onDeleteComment: (taskId: string, commentId: string) => void
  onDeleteCommentAttachment: (taskId: string, commentId: string, attachmentId: string) => Promise<void>
  onUploadAttachments: (taskId: string, files: File[]) => Promise<boolean>
  onRemoveAttachment: (attachmentId: string) => void
  onTaskDeleted: () => void
  showError: (title: string, msg: string) => void
  showSuccess: (title: string, msg: string) => void
  getAssigneeColor: (id: string) => { bg: string; text: string }
  staffInitials: (o: StaffSelectOption) => string
  staffLabel: (o: StaffSelectOption) => string
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [pendingDescriptionHtml, setPendingDescriptionHtml] = useState<string | null>(null)
  /* Create-mode-only state */
  const [createDescriptionHtml, setCreateDescriptionHtml] = useState('')
  const [createStatus, setCreateStatus] = useState<TaskStatus>(defaultStatus ?? 'todo')
  const [createPriority, setCreatePriority] = useState<TaskPriority | ''>('medium')
  const [createType, setCreateType] = useState<TaskType | ''>('feature')
  const [createDueDate, setCreateDueDate] = useState('')
  const [createAssigneeIds, setCreateAssigneeIds] = useState<string[]>([])
  const [createInitialFiles, setCreateInitialFiles] = useState<File[]>([])
  const [createSaving, setCreateSaving] = useState(false)
  const [createDescriptionError, setCreateDescriptionError] = useState<string | null>(null)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [showMentionPicker, setShowMentionPicker] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionAnchorIndex, setMentionAnchorIndex] = useState(-1)
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0)
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [commentFilePreviews, setCommentFilePreviews] = useState<Array<{ isImage: boolean; previewUrl: string | null }>>([])
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [attachmentMenuOpenId, setAttachmentMenuOpenId] = useState<string | null>(null)
  const [activityPanelOpen, setActivityPanelOpen] = useState(false)
  const [detailDropdownOpen, setDetailDropdownOpen] = useState<'status' | 'assignee' | 'priority' | 'type' | null>(null)
  const [detailDropdownRect, setDetailDropdownRect] = useState<{ top: number; left: number } | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [mobileDetailTab, setMobileDetailTab] = useState<'details' | 'comments'>('details')
  const commentAttachmentInputRef = useRef<HTMLInputElement>(null)
  const commentPreviewUrlsRef = useRef<Set<string>>(new Set())
  const detailStatusRef = useRef<HTMLButtonElement>(null)
  const detailAssigneeRef = useRef<HTMLButtonElement>(null)
  const detailPriorityRef = useRef<HTMLButtonElement>(null)
  const detailTypeRef = useRef<HTMLButtonElement>(null)
  const detailDueInputRef = useRef<HTMLInputElement>(null)

  const getDetailTriggerRect = () => {
    const ref =
      detailDropdownOpen === 'status'
        ? detailStatusRef
        : detailDropdownOpen === 'assignee'
          ? detailAssigneeRef
          : detailDropdownOpen === 'priority'
            ? detailPriorityRef
            : detailTypeRef
    return ref.current?.getBoundingClientRect() ?? null
  }

  useEffect(() => {
    if (!detailDropdownOpen) {
      setDetailDropdownRect(null)
      return
    }
    const update = () => {
      const rect = getDetailTriggerRect()
      if (rect) setDetailDropdownRect({ top: rect.bottom + 4, left: rect.left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [detailDropdownOpen])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!detailDropdownOpen) return
      const target = e.target as Element
      if (target.closest('[data-detail-dropdown]')) return
      setDetailDropdownOpen(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [detailDropdownOpen])

  useEffect(() => {
    if (!attachmentMenuOpenId) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element
      if (target.closest(`[data-attachment-menu-id="${attachmentMenuOpenId}"]`)) return
      setAttachmentMenuOpenId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [attachmentMenuOpenId])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailDropdownOpen(null)
        setAttachmentMenuOpenId(null)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [detailDropdownOpen])

  useEffect(() => {
    if (taskDetail) {
      setTitleValue(taskDetail.title)
    } else if (isCreateMode) {
      setTitleValue('')
    }
  }, [taskDetail?.id, taskDetail?.title, isCreateMode])

  useEffect(() => {
    if (isCreateMode && defaultStatus) setCreateStatus(defaultStatus)
  }, [isCreateMode, defaultStatus])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleViewportChange = () => {
      setIsMobileViewport(mediaQuery.matches)
    }

    handleViewportChange()
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange)
      return () => mediaQuery.removeEventListener('change', handleViewportChange)
    }

    mediaQuery.addListener(handleViewportChange)
    return () => mediaQuery.removeListener(handleViewportChange)
  }, [])

  useEffect(() => {
    setMobileDetailTab('details')
  }, [taskId])

  useEffect(() => {
    setPendingDescriptionHtml(null)
  }, [taskDetail?.id])

  const savedDescription = (taskDetail?.description_html ?? '').trim()
  const currentDescription = (pendingDescriptionHtml ?? savedDescription).trim()
  const descriptionDirty = canEditTask && pendingDescriptionHtml != null && currentDescription !== savedDescription

  const createHasContent = isCreateMode && (titleValue.trim() || createDescriptionHtml.trim())
  const handleCloseRequest = () => {
    if (descriptionDirty || createHasContent) {
      setCloseConfirmOpen(true)
    } else {
      onClose()
    }
  }

  const handleSaveDescription = async () => {
    if (!descriptionDirty) return
    await onUpdateTask(taskId, { description_html: pendingDescriptionHtml ?? taskDetail?.description_html ?? null })
    setPendingDescriptionHtml(null)
  }

  const handleCloseConfirmDiscard = () => {
    setPendingDescriptionHtml(null)
    setCloseConfirmOpen(false)
    onClose()
  }

  const handleCloseConfirmSave = async () => {
    setCloseConfirmOpen(false)
    if (isCreateMode && !taskDetail) {
      await handleCreateSave()
      // Parent switches to new task; panel stays open to show it
    } else {
      await handleSaveDescription()
      onClose()
    }
  }

  const filteredMentionUsers = mentionableUsers.filter((u) => {
    const name = getUserName(u).toLowerCase()
    const search = mentionSearch.toLowerCase()
    return name.includes(search)
  }).slice(0, 8)

  const validateSelectedAttachmentFiles = (files: File[]) => {
    for (const file of files) {
      const validation = validateTaskAttachmentFile(file)
      if (!validation.ok) {
        showError(validation.title, validation.message)
        return false
      }
    }
    return true
  }

  const clearSelectedCommentFiles = () => {
    setCommentFiles([])
    setCommentFilePreviews((prev) => {
      prev.forEach((entry) => {
        if (!entry.previewUrl) return
        URL.revokeObjectURL(entry.previewUrl)
        commentPreviewUrlsRef.current.delete(entry.previewUrl)
      })
      return []
    })
  }

  useEffect(() => {
    const previewUrlsRef = commentPreviewUrlsRef
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewUrlsRef.current.clear()
    }
  }, [])

  const handleCommentAttachmentSelect = (files: File[]) => {
    if (commentSubmitting || files.length === 0) return
    if (!validateSelectedAttachmentFiles(files)) return
    const previews = files.map((file) => {
      const mimeType = resolveTaskAttachmentMimeType(file) || ''
      const isImage = mimeType.startsWith('image/')
      const previewUrl = isImage ? URL.createObjectURL(file) : null
      if (previewUrl) commentPreviewUrlsRef.current.add(previewUrl)
      return { isImage, previewUrl }
    })
    setCommentFiles((prev) => [...prev, ...files])
    setCommentFilePreviews((prev) => [...prev, ...previews])
  }

  const handleCommentAttachmentRemove = (index: number) => {
    setCommentFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))
    setCommentFilePreviews((prev) => {
      const target = prev[index]
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl)
        commentPreviewUrlsRef.current.delete(target.previewUrl)
      }
      return prev.filter((_, fileIndex) => fileIndex !== index)
    })
  }

  const handleCommentTextChange = (value: string) => {
    setCommentText(value)
    const lastAt = value.lastIndexOf('@')
    if (lastAt >= 0) {
      const after = value.slice(lastAt + 1)
      if (!/\s/.test(after)) {
        setShowMentionPicker(true)
        setMentionSearch(after)
        setMentionAnchorIndex(lastAt)
        setMentionHighlightIndex(0)
      } else {
        setShowMentionPicker(false)
      }
    } else {
      setShowMentionPicker(false)
    }
  }

  const handleMentionSelect = (user: TaskAssignee) => {
    const name = getUserName(user)
    const before = mentionAnchorIndex > 0 ? commentText.slice(0, mentionAnchorIndex) : ''
    const after = commentText.slice(mentionAnchorIndex + 1 + mentionSearch.length)
    setCommentText(before + '@' + name + ' ' + after)
    setMentionIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]))
    setShowMentionPicker(false)
    setMentionSearch('')
  }

  const handleCommentSubmit = async () => {
    const trimmed = commentText.trim()
    if (!trimmed && commentFiles.length === 0) {
      showError('Comment required', 'Add a comment or at least one attachment before posting.')
      return
    }

    setCommentSubmitting(true)
    let targetTaskId = taskId
    if (isCreateFlow) {
      const newTaskId = await handleCreateSave()
      if (!newTaskId) {
        setCommentSubmitting(false)
        return
      }
      targetTaskId = newTaskId
    }
    const ok = await onAddComment(targetTaskId, trimmed, mentionIds, commentFiles)
    setCommentSubmitting(false)
    if (!ok) return

    setCommentText('')
    setMentionIds([])
    setShowMentionPicker(false)
    setMentionSearch('')
    clearSelectedCommentFiles()
  }

  const isCreateFlow = isCreateMode && !taskDetail && !detailLoading
  if (!isCreateFlow && (detailLoading || !taskDetail)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-0 sm:p-4 md:p-6">
        <div className="flex h-full w-full max-h-full flex-col overflow-hidden rounded-none bg-white pt-[env(safe-area-inset-top)] shadow-xl sm:rounded-2xl sm:pt-0">
          {/* Skeleton header */}
          <header className="flex-shrink-0 bg-slate-50/50 border-b border-slate-200">
            <div className="flex items-center justify-between px-3.5 py-3 sm:px-5">
              <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                <span className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
                <span className="h-5 flex-1 max-w-xs rounded bg-slate-200 animate-pulse" />
              </div>
              <div className="flex items-center gap-1">
                <span className="h-9 w-9 rounded-xl bg-slate-200 animate-pulse" />
                <span className="h-9 w-9 rounded-xl bg-slate-200 animate-pulse" />
                <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-600" aria-label="Close" title="Close">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="border-t border-slate-200/80 px-3.5 pb-4 pt-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-6 w-16 rounded-md bg-slate-200 animate-pulse" />
                <span className="h-8 w-20 rounded-full bg-slate-200 animate-pulse" />
                <span className="h-6 w-20 rounded bg-slate-200 animate-pulse" />
                <span className="h-6 w-24 rounded bg-slate-200 animate-pulse" />
                <span className="h-6 w-14 rounded-full bg-slate-200 animate-pulse" />
              </div>
            </div>
          </header>
          {/* Skeleton body: two-column layout */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0 overflow-hidden">
            <div className="overflow-y-auto border-b border-slate-200 p-3.5 md:border-b-0 md:border-r md:p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-4 w-4 rounded bg-slate-200 animate-pulse" />
                  <span className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                </div>
                <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-4 w-4 rounded bg-slate-200 animate-pulse" />
                  <span className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
                </div>
                <div className="h-[60px] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col overflow-y-auto p-3.5 md:p-6">
              <div className="h-4 w-36 rounded bg-slate-200 animate-pulse mb-4" />
              <div className="space-y-3 flex-1">
                <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isDescriptionEmpty = (html: string) => {
    if (!html || !html.trim()) return true
    if (typeof document === 'undefined') return !html.replace(/<[^>]*>/g, '').trim()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return !(doc.body.textContent || '').trim()
  }
  const handleCreateSave = async (): Promise<string | undefined> => {
    if (!onCreateTask) return undefined
    setCreateDescriptionError(null)
    const t = titleValue.trim()
    if (!t) {
      showError('Validation', 'Title is required.')
      return undefined
    }
    const desc = isCreateFlow ? createDescriptionHtml : (pendingDescriptionHtml ?? taskDetail?.description_html ?? '')
    if (isCreateFlow && isDescriptionEmpty(desc)) {
      setCreateDescriptionError('Description is required.')
      return undefined
    }
    if (isCreateFlow) {
      setCreateSaving(true)
      const result = await onCreateTask({
        title: t,
        description_html: desc || null,
        task_type: createType || null,
        priority: createPriority || null,
        status: createStatus,
        due_date: createDueDate || null,
        assignee_ids: createAssigneeIds,
        initial_files: createInitialFiles.length > 0 ? createInitialFiles : undefined,
      })
      setCreateSaving(false)
      return result?.data?.id
    } else {
      await handleSaveDescription()
      return undefined
    }
  }
  const showHeaderSave = isCreateFlow || descriptionDirty
  const commentCount = taskDetail?.comments.length ?? 0

  const detailsSection = (
    <div className="h-full min-h-0 overflow-y-auto p-3.5 md:border-r md:border-slate-200 md:p-6">
        {/* Description — full width with icon + label row */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-slate-600">Description</span>
          </div>
          {isCreateFlow ? (
            <>
              <ProjectTasksRichEditor
                value={createDescriptionHtml}
                onChange={(html) => { setCreateDescriptionHtml(html); if (createDescriptionError) setCreateDescriptionError(null) }}
                minHeight="120px"
                editable={true}
                placeholder="Describe the task…"
              />
              {createDescriptionError && (
                <p className="mt-1.5 text-sm text-red-600" role="alert">{createDescriptionError}</p>
              )}
            </>
          ) : canEditTask ? (
            <ProjectTasksRichEditor
              value={pendingDescriptionHtml ?? taskDetail!.description_html ?? ''}
              onChange={(html) => setPendingDescriptionHtml(html)}
              minHeight="120px"
              editable={true}
            />
          ) : (
            <div
              className="prose prose-sm max-w-none text-slate-700 rounded-xl border border-slate-200 bg-slate-50/30 p-4 min-h-[80px]"
              dangerouslySetInnerHTML={{
                __html: taskDetail!.description_html || '<p class="text-slate-400">No description</p>',
              }}
            />
          )}
        </div>

        {/* Attachments — upload zone + grid with hover view/delete */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-600">
            <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="text-sm font-medium">Attachments</span>
            {isCreateFlow && (
              <span className="text-xs text-slate-500">(uploaded when you save)</span>
            )}
            {!isCreateFlow && taskDetail!.attachments.length > 0 && (
              <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                {taskDetail!.attachments.length}
              </span>
            )}
            {isCreateFlow && createInitialFiles.length > 0 && (
              <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                {createInitialFiles.length}
              </span>
            )}
          </div>

          {isCreateFlow ? (
            <>
              <label className="flex items-center justify-center gap-2 h-[60px] min-h-[60px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 cursor-pointer transition-colors hover:border-[#06B6D4]/50 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-[#06B6D4]/30 focus-within:border-[#06B6D4]">
                <input
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const list = Array.from(e.target.files ?? [])
                    if (list.length > 0 && !validateSelectedAttachmentFiles(list)) {
                      e.target.value = ''
                      return
                    }
                    setCreateInitialFiles((prev) => [...prev, ...list])
                    e.target.value = ''
                  }}
                />
                <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-xs text-slate-600">
                  Add files (max {MAX_FILE_MB} MB). Attachments are uploaded when you save the task.
                </span>
              </label>
              {createInitialFiles.length > 0 && (
                <ul className="space-y-1.5">
                  {createInitialFiles.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm">
                      <span className="truncate text-slate-700">{f.name}</span>
                      <button type="button" onClick={() => setCreateInitialFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-rose-600 hover:text-rose-700 text-xs font-medium ml-2">Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : canManageAttachments && (
            <label
              className="flex items-center justify-center gap-2 h-[60px] min-h-[60px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 cursor-pointer transition-colors hover:border-[#06B6D4]/50 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-[#06B6D4]/30 focus-within:border-[#06B6D4]"
            >
              <input
                key={fileInputKey}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                multiple
                className="sr-only"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length === 0) return
                  if (!validateSelectedAttachmentFiles(files)) {
                    e.target.value = ''
                    return
                  }
                  const ok = await onUploadAttachments(taskId, files)
                  if (ok) setFileInputKey((k) => k + 1)
                  e.target.value = ''
                }}
              />
              <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-xs text-slate-600">
                Drop your files here to upload, or <span className="underline font-medium text-cyan-600">browse</span> (max {MAX_FILE_MB} MB)
              </span>
            </label>
          )}

          {!isCreateFlow && taskDetail!.attachments.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {taskDetail!.attachments.map((a) => (
                <div
                  key={a.id}
                  data-attachment-menu-id={a.id}
                  className="group relative rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="aspect-[4/3] bg-slate-100 relative">
                    {isImageAttachment(a) ? (
                      <img
                        src={a.cloudinary_url}
                        alt={a.file_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                    {/* More button: top-right, visible on hover (or when menu is open) */}
                    <div className={`absolute top-2 right-2 transition-opacity ${attachmentMenuOpenId === a.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAttachmentMenuOpenId((id) => (id === a.id ? null : a.id)) }}
                        className="p-1.5 rounded-lg bg-white/95 shadow-sm border border-slate-200/80 text-slate-600 hover:bg-white hover:text-slate-800 transition-colors"
                        aria-label="More actions"
                        title="More actions"
                        aria-expanded={attachmentMenuOpenId === a.id}
                        aria-haspopup="true"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                      {attachmentMenuOpenId === a.id && (
                        <div className="absolute top-full right-0 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1 z-10">
                          <a
                            href={a.cloudinary_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => setAttachmentMenuOpenId(null)}
                            aria-label="View attachment"
                            title="View attachment"
                          >
                            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7C7.523 19 3.732 16.057 2.458 12z" />
                            </svg>
                            View
                          </a>
                          <a
                            href={a.cloudinary_url}
                            download={a.file_name}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => setAttachmentMenuOpenId(null)}
                            aria-label="Download attachment"
                            title="Download attachment"
                          >
                            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </a>
                          {canManageAttachments && (
                            <button
                              type="button"
                              onClick={() => { onRemoveAttachment(a.id); setAttachmentMenuOpenId(null) }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                              aria-label="Remove attachment"
                              title="Remove attachment"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-2.5 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate" title={a.file_name}>{a.file_name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{formatAttachmentDate(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  )

  const commentsSection = (
    <div className="h-full min-h-0 overflow-hidden p-3.5 sm:p-4 md:p-5 flex flex-col">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200 mb-3 flex-shrink-0">
        Comments
      </h3>
      {isCreateFlow && (
        <p className="text-sm text-slate-500 flex-shrink-0 mb-3">Add a comment below. The task will be saved when you post.</p>
      )}
      {!isCreateFlow && (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-3">
          {taskDetail!.comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                <svg className="h-10 w-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm font-medium">No comments yet</p>
                <p className="text-xs mt-0.5">Add a comment below to start the conversation.</p>
              </div>
          ) : null}
          {taskDetail!.comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              currentUserId={currentUserId}
              taskId={taskId}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
              onDeleteCommentAttachment={onDeleteCommentAttachment}
              getInitials={getInitials}
            />
          ))}
        </div>
      )}
      {userRole !== 'client' && (
            <div className="flex-shrink-0 pt-3 mt-auto relative">
              {/* Single comment container: typing area + toolbar (attachment + send) inside */}
              <div className="rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-[#06B6D4]/30 focus-within:border-[#06B6D4] bg-white flex flex-col min-h-[100px] max-h-[280px]">
                  {/* Typing area */}
                  <div className="relative flex-1 min-h-[72px] overflow-hidden rounded-t-xl">
                    <div
                      className="absolute inset-0 px-4 pt-3 pb-2 text-sm whitespace-pre-wrap overflow-hidden pointer-events-none"
                      aria-hidden
                    >
                      {commentText ? (
                        <span className="text-slate-700">
                          {renderCommentWithMentions(commentText, mentionableUsers.filter((u) => mentionIds.includes(u.id)))}
                        </span>
                      ) : null}
                    </div>
                    <textarea
                      value={commentText}
                      onChange={(e) => handleCommentTextChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (showMentionPicker && filteredMentionUsers.length > 0) {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleMentionSelect(filteredMentionUsers[mentionHighlightIndex])
                            return
                          }
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            setMentionHighlightIndex((i) => (i + 1) % filteredMentionUsers.length)
                            return
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setMentionHighlightIndex((i) => (i - 1 + filteredMentionUsers.length) % filteredMentionUsers.length)
                            return
                          }
                        }
                        if (e.key === 'Escape') setShowMentionPicker(false)
                      }}
                      placeholder="Add a comment… Type @ to mention"
                      className="relative z-10 w-full min-h-[72px] max-h-[200px] border-0 bg-transparent px-4 pt-3 pb-2 text-sm focus:outline-none focus:ring-0 resize-none text-transparent caret-slate-800 placeholder:text-slate-400 block"
                      rows={3}
                    />
                  </div>
                  <input
                    ref={commentAttachmentInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      e.target.value = ''
                      if (files.length === 0) return
                      handleCommentAttachmentSelect(files)
                    }}
                  />
                  {commentFiles.length > 0 && (
                    <div className="border-t border-slate-200 px-3 py-2">
                      <div className="flex flex-wrap gap-3 overflow-x-auto">
                        {commentFiles.map((file, index) => {
                          const preview = commentFilePreviews[index]
                          const isImage = preview?.isImage ?? false
                          const objectUrl = preview?.previewUrl ?? null
                          const extension = getTaskAttachmentFileExtension(file.name)
                          const isPdf = extension === 'pdf'

                          return (
                            <div
                              key={`${file.name}-${index}`}
                              className="relative w-[148px] flex-shrink-0"
                            >
                              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm ring-1 ring-slate-100">
                                <div className="h-20 w-full bg-slate-100">
                                  {isImage && objectUrl ? (
                                    <img
                                      src={objectUrl}
                                      alt={file.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2">
                                      <svg
                                        className={`h-8 w-8 ${isPdf ? 'text-red-500' : 'text-slate-500'}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                        aria-hidden
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m-6-8h6M7 20h10a2 2 0 002-2V8l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                      {extension ? (
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${isPdf ? 'bg-rose-50 text-rose-600' : 'bg-slate-200 text-slate-600'}`}>
                                          {extension}
                                        </span>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                                <div className="border-t border-slate-200/80 bg-white px-2 py-1.5">
                                  <p className="truncate text-xs font-medium text-slate-700" title={file.name}>
                                    {file.name}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCommentAttachmentRemove(index)}
                                  disabled={commentSubmitting}
                                  className="absolute right-1.5 top-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/90 bg-white text-rose-600 shadow-md transition-colors hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-1 disabled:opacity-50"
                                  aria-label={`Remove ${file.name}`}
                                  title="Remove attachment"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {/* Toolbar inside container: attachment + send only */}
                  <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-200 rounded-b-xl bg-slate-50/50">
                    <div className="flex items-center gap-1">
                      <Tooltip content="Attach file">
                        <button
                          type="button"
                          onClick={() => commentAttachmentInputRef.current?.click()}
                          disabled={commentSubmitting}
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 disabled:opacity-50 disabled:hover:bg-transparent"
                          aria-label="Attach file"
                          title="Attach file"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        </button>
                      </Tooltip>
                    </div>
                    <Tooltip
                      content={
                        commentSubmitting
                          ? 'Posting comment…'
                          : commentText.trim() || commentFiles.length > 0
                            ? 'Post comment'
                            : 'Type a comment or attach a file to post'
                      }
                    >
                      <button
                        type="button"
                        onClick={handleCommentSubmit}
                        disabled={commentSubmitting || (!commentText.trim() && commentFiles.length === 0)}
                        className={`flex-shrink-0 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 disabled:opacity-50 disabled:hover:bg-transparent ${
                          commentText.trim() || commentFiles.length > 0
                            ? 'text-[#06B6D4] hover:bg-cyan-50'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/60'
                        }`}
                        aria-label={commentSubmitting ? 'Posting comment' : 'Post comment'}
                        title={commentSubmitting ? 'Posting comment' : 'Post comment'}
                      >
                        {commentSubmitting ? (
                          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                      </button>
                    </Tooltip>
                  </div>
              </div>
              {showMentionPicker && filteredMentionUsers.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-slate-200 bg-white shadow-xl py-1 max-h-48 overflow-y-auto z-10">
                  {filteredMentionUsers.map((u, idx) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleMentionSelect(u)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${idx === mentionHighlightIndex ? 'bg-cyan-50 ring-1 ring-cyan-200' : 'hover:bg-slate-50'}`}
                    >
                      <span className="h-7 w-7 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center text-xs font-semibold">
                        {getInitials(getUserName(u))}
                      </span>
                      <span className="truncate" title={getUserName(u)}>{getUserName(u)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-0 sm:p-4 md:p-6" onClick={(e) => e.target === e.currentTarget && handleCloseRequest()}>
      <div className="relative flex h-full w-full max-h-full flex-col overflow-hidden rounded-none bg-white pt-[env(safe-area-inset-top)] shadow-xl sm:rounded-2xl sm:pt-0" onClick={(e) => e.stopPropagation()}>
        {/* Header: Task details + title (editable) + actions */}
        <header className="flex-shrink-0 bg-slate-50/50 border-b border-slate-200">
          <div className="flex items-center justify-between px-3.5 py-3 sm:px-5">
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
              {isCreateFlow && createSaving && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                  <svg className="h-5 w-5 animate-spin text-cyan-600" fill="none" viewBox="0 0 24 24" aria-label="Saving">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </span>
              )}
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0 border-b-2 border-[#06B6D4] pb-0.5">{isCreateFlow ? 'New Task' : 'Task details'}</span>
              {isCreateFlow ? (
                <input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  placeholder="Task title"
                  className="flex-1 min-w-0 text-base font-semibold text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]"
                />
              ) : editingTitle && canEditTask ? (
                <input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={async () => {
                    setEditingTitle(false)
                    if (taskDetail && titleValue.trim() !== taskDetail.title) {
                      await onUpdateTask(taskId, { title: titleValue.trim() })
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setEditingTitle(false)
                      if (taskDetail && titleValue.trim() !== taskDetail.title) {
                        onUpdateTask(taskId, { title: titleValue.trim() })
                      }
                    }
                    if (e.key === 'Escape') setEditingTitle(false)
                  }}
                  className="flex-1 min-w-0 text-base font-semibold text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]"
                  autoFocus
                />
              ) : (
                <h2
                  className={`text-base font-semibold text-slate-800 truncate flex-1 min-w-0 ${canEditTask ? 'cursor-pointer hover:bg-slate-100 rounded-lg px-2 py-1 -mx-1 transition-colors' : ''}`}
                  onClick={() => canEditTask && setEditingTitle(true)}
                >
                  {taskDetail?.title ?? 'Task'}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-1">
              {showHeaderSave && (
                <Tooltip content={isCreateFlow && createInitialFiles.length > 0 ? 'Save task (attachments will be uploaded)' : isCreateFlow ? 'Save new task' : 'Save description'}>
                  <button type="button" onClick={handleCreateSave} disabled={isCreateFlow && createSaving} className="p-2 rounded-xl text-cyan-600 hover:bg-cyan-50 transition-colors disabled:opacity-50" aria-label="Save" title={isCreateFlow && createInitialFiles.length > 0 ? 'Save task (attachments will be uploaded)' : isCreateFlow ? 'Save new task' : 'Save description'}>
                    {isCreateFlow && createSaving ? (
                      <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                    )}
                  </button>
                </Tooltip>
              )}
              {!isCreateFlow && (
                <Tooltip content={taskDetail ? `View activity (${taskDetail.activity_log.length} entries)` : 'View activity'}>
                  <button type="button" onClick={() => setActivityPanelOpen(true)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors" aria-label="View activity" title={taskDetail ? `View activity (${taskDetail?.activity_log.length ?? 0} entries)` : 'View activity'}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </Tooltip>
              )}
              {canEditTask && !isCreateFlow && (
                <Tooltip content="Delete task">
                  <button type="button" onClick={onRequestDelete} className="p-2 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors" aria-label="Delete task" title="Delete task">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </Tooltip>
              )}
              <Tooltip content="Close task panel">
                <button type="button" onClick={handleCloseRequest} className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors" aria-label="Close panel" title="Close task panel">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </Tooltip>
            </div>
          </div>
          <div className="border-t border-slate-200/80 px-3.5 pb-4 pt-3 sm:px-5">
            {/* Same compact row as Task List View: Status | Assignees | Due date | Priority | Type */}
            {(() => {
              const metaStatus = isCreateFlow ? createStatus : (taskDetail?.status ?? 'todo')
              const metaAssigneeIds = isCreateFlow ? createAssigneeIds : (taskDetail?.assignees.map((a) => a.id) ?? [])
              const metaDueDate = isCreateFlow ? createDueDate : (taskDetail?.due_date ?? '')
              const metaPriority = isCreateFlow ? createPriority : (taskDetail?.priority ?? '')
              const metaType = isCreateFlow ? createType : (taskDetail?.task_type ?? '')
              return (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs sm:gap-y-2">
              <span className="font-medium text-slate-500">Status:</span>
              {/* Status — list row style */}
              {(canUpdateStatus || isCreateFlow) ? (
                <div className="relative inline-block">
                  <button
                    ref={detailStatusRef}
                    type="button"
                    onClick={() => setDetailDropdownOpen((o) => (o === 'status' ? null : 'status'))}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
                    title="Change status"
                  >
                    <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT_COLORS[metaStatus] ?? 'bg-slate-400'}`} />
                    <span>{TASK_STATUS_LABELS[metaStatus] ?? metaStatus}</span>
                  </button>
                  {detailDropdownOpen === 'status' && detailDropdownRect && typeof document !== 'undefined' &&
                    createPortal(
                      <>
                        <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setDetailDropdownOpen(null)} />
                        <div data-detail-dropdown className="fixed z-[9999] w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1" style={{ top: detailDropdownRect.top, left: detailDropdownRect.left }}>
                          {TASK_STATUSES.map((s) => (
                            <button key={s} type="button" onClick={() => { if (isCreateFlow) setCreateStatus(s); else onStatusChange(taskId, s); setDetailDropdownOpen(null) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${TASK_STATUS_DOT_COLORS[s] ?? 'bg-slate-400'}`} />
                              <span>{TASK_STATUS_LABELS[s] ?? s}</span>
                            </button>
                          ))}
                        </div>
                      </>,
                      document.body
                    )}
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT_COLORS[metaStatus] ?? 'bg-slate-400'}`} />
                  {TASK_STATUS_LABELS[metaStatus] ?? metaStatus}
                </span>
              )}
              <span className="hidden text-slate-300 sm:inline">|</span>

              <span className="font-medium text-slate-500">Assignee:</span>
              {/* Assignees — list row style (avatar stack + dropdown) */}
              {(() => {
                const assigneeIds = Array.isArray(metaAssigneeIds) ? metaAssigneeIds : []
                const assigneeOptions = assigneeIds.map((id) => {
                  const m = assignableUsers.find((u) => u.id === id)
                  const a = taskDetail?.assignees?.find((x) => x.id === id)
                  return (m ?? (a ? { id: a.id, full_name: a.full_name, email: a.email, role: a.role } : null)) as StaffSelectOption | null
                }).filter(Boolean) as StaffSelectOption[]
                const maxAvatars = 3
                const assigneesToShow = assigneeOptions.slice(0, maxAvatars)
                const extraCount = assigneeOptions.length - maxAvatars
                const assigneeNamesTooltip = assigneeOptions.length > 0 ? assigneeOptions.map((o) => staffLabel(o)).join(', ') : 'No assignees'
                const extraAssigneesTooltip = extraCount > 0 ? assigneeOptions.slice(maxAvatars).map((o) => staffLabel(o)).join(', ') : ''
                if (canEditTask) {
                  return (
                    <div className="relative inline-block">
                      <button
                        ref={detailAssigneeRef}
                        type="button"
                        onClick={() => setDetailDropdownOpen((o) => (o === 'assignee' ? null : 'assignee'))}
                        className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
                        title={assigneeOptions.length === 0 ? 'Change assignee' : assigneeNamesTooltip}
                      >
                        {assigneeOptions.length > 0 ? (
                          <span className="flex items-center -space-x-2">
                            {assigneesToShow.map((m) => (
                              <span
                                key={m.id}
                                title={staffLabel(m)}
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-semibold ring-1 ring-slate-200 ${getAssigneeColor(m.id).bg} ${getAssigneeColor(m.id).text}`}
                              >
                                {staffInitials(m)}
                              </span>
                            ))}
                            {extraCount > 0 && (
                              <span
                                title={extraAssigneesTooltip}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                              >
                                +{extraCount}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </span>
                        )}
                      </button>
                      {detailDropdownOpen === 'assignee' && detailDropdownRect && typeof document !== 'undefined' &&
                        createPortal(
                          <>
                            <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setDetailDropdownOpen(null)} />
                            <div data-detail-dropdown className="fixed z-[9999] w-56 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl py-1" style={{ top: detailDropdownRect.top, left: detailDropdownRect.left }}>
                              {assignableUsers.map((m) => {
                                const isSelected = assigneeIds.includes(m.id)
                                const color = getAssigneeColor(m.id)
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      const next = isSelected ? assigneeIds.filter((id) => id !== m.id) : [...assigneeIds, m.id]
                                      if (isCreateFlow) setCreateAssigneeIds(next)
                                      else onAssigneesChange(taskId, next)
                                      setDetailDropdownOpen(null)
                                    }}
                                    className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 ${isSelected ? 'bg-cyan-50/80' : ''}`}
                                  >
                                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${color.bg} ${color.text}`}>
                                      {staffInitials(m)}
                                    </span>
                                    <span className="text-sm truncate">{staffLabel(m)}</span>
                                    {isSelected && (
                                      <svg className="h-4 w-4 ml-auto text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </>,
                          document.body
                        )}
                    </div>
                  )
                }
                return assigneeOptions.length > 0 ? (
                  <span className="inline-flex items-center -space-x-2">
                    {assigneesToShow.map((m) => (
                      <span
                        key={m.id}
                        title={staffLabel(m)}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-semibold ring-1 ring-slate-200 ${getAssigneeColor(m.id).bg} ${getAssigneeColor(m.id).text}`}
                      >
                        {staffInitials(m)}
                      </span>
                    ))}
                    {extraCount > 0 && (
                      <span
                        title={extraAssigneesTooltip}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                      >
                        +{extraCount}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">—</span>
                )
              })()}
              <span className="hidden text-slate-300 sm:inline">|</span>

              <span className="font-medium text-slate-500">Due Date:</span>
              {/* Due date — list row style */}
              {(canEditTask || isCreateFlow) ? (
                <div className="relative inline-block">
                  <input
                    ref={detailDueInputRef}
                    type="date"
                    value={metaDueDate}
                    onChange={(e) => { if (isCreateFlow) setCreateDueDate(e.target.value); else onUpdateTask(taskId, { due_date: e.target.value || null }) }}
                    className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer pointer-events-none"
                    aria-hidden
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (detailDueInputRef.current) {
                        try {
                          detailDueInputRef.current.showPicker?.()
                        } catch {
                          detailDueInputRef.current.focus()
                        }
                      }
                    }}
                    className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
                    title="Select due date"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {metaDueDate ? formatDate(metaDueDate) : '—'}
                  </button>
                </div>
              ) : (
                <span className="text-slate-600 text-xs">{metaDueDate ? formatDate(metaDueDate) : '—'}</span>
              )}
              <span className="hidden text-slate-300 sm:inline">|</span>

              <span className="font-medium text-slate-500">Priority:</span>
              {/* Priority — list row style */}
              {(canEditTask || isCreateFlow) ? (
                <div className="relative inline-block">
                  <button
                    ref={detailPriorityRef}
                    type="button"
                    onClick={() => setDetailDropdownOpen((o) => (o === 'priority' ? null : 'priority'))}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 ${
                      metaPriority
                        ? `border-slate-200/80 ${TASK_PRIORITY_STYLES[metaPriority as TaskPriority]}`
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                    title="Change priority"
                  >
                    <PriorityFlagIcon className={`h-4 w-4 flex-shrink-0 ${metaPriority ? TASK_PRIORITY_FLAG_COLORS[metaPriority as TaskPriority] : 'text-slate-400'}`} />
                    <span>{metaPriority ? TASK_PRIORITY_LABELS[metaPriority as TaskPriority] : '—'}</span>
                  </button>
                  {detailDropdownOpen === 'priority' && detailDropdownRect && typeof document !== 'undefined' &&
                    createPortal(
                      <>
                        <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setDetailDropdownOpen(null)} />
                        <div data-detail-dropdown className="fixed z-[9999] w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1" style={{ top: detailDropdownRect.top, left: detailDropdownRect.left }}>
                          {TASK_PRIORITIES.map((p) => (
                            <button key={p} type="button" onClick={() => { if (isCreateFlow) setCreatePriority(p); else onUpdateTask(taskId, { priority: p }); setDetailDropdownOpen(null) }} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-sky-50 ${metaPriority === p ? 'bg-sky-50' : ''}`}>
                            <PriorityFlagIcon className={`h-4 w-4 flex-shrink-0 ${TASK_PRIORITY_FLAG_COLORS[p]}`} />
                            <span>{TASK_PRIORITY_LABELS[p]}</span>
                          </button>
                        ))}
                        </div>
                      </>,
                      document.body
                    )}
                </div>
              ) : (
                <span className={`inline-flex items-center gap-1.5 text-xs ${metaPriority ? TASK_PRIORITY_STYLES[metaPriority as TaskPriority] : 'text-slate-400'}`}>
                  {metaPriority && <PriorityFlagIcon className={`h-4 w-4 ${TASK_PRIORITY_FLAG_COLORS[metaPriority as TaskPriority]}`} />}
                  {metaPriority ? TASK_PRIORITY_LABELS[metaPriority as TaskPriority] : '—'}
                </span>
              )}
              <span className="hidden text-slate-300 sm:inline">|</span>

              <span className="font-medium text-slate-500">Type:</span>
              {/* Type — same pill style as list (detail-only field) */}
              {(canEditTask || isCreateFlow) ? (
                <div className="relative inline-block">
                  <button
                    ref={detailTypeRef}
                    type="button"
                    onClick={() => setDetailDropdownOpen((o) => (o === 'type' ? null : 'type'))}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
                    title="Change type"
                  >
                    {metaType ? <TaskTypeIcon type={metaType as TaskType} className="h-4 w-4 flex-shrink-0 text-slate-500" /> : null}
                    <span>{metaType ? TASK_TYPE_LABELS[metaType as TaskType] : '—'}</span>
                  </button>
                  {detailDropdownOpen === 'type' && detailDropdownRect && typeof document !== 'undefined' &&
                    createPortal(
                      <>
                        <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setDetailDropdownOpen(null)} />
                        <div data-detail-dropdown className="fixed z-[9999] w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1" style={{ top: detailDropdownRect.top, left: detailDropdownRect.left }}>
                          {TASK_TYPES.map((t) => (
                            <button key={t} type="button" onClick={() => { if (isCreateFlow) setCreateType(t); else onUpdateTask(taskId, { task_type: t }); setDetailDropdownOpen(null) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                              <TaskTypeIcon type={t} className="h-4 w-4 text-slate-500" />
                              {TASK_TYPE_LABELS[t]}
                            </button>
                          ))}
                        </div>
                      </>,
                      document.body
                    )}
                </div>
              ) : (
                metaType ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                    <TaskTypeIcon type={metaType as TaskType} className="h-4 w-4 text-slate-500" />
                    {TASK_TYPE_LABELS[metaType as TaskType]}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )
              )}
            </div>
            )
            })()}
          </div>
        </header>
        {isMobileViewport && !isCreateFlow && (
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3.5 py-2 sm:hidden">
            <button
              type="button"
              onClick={() => setMobileDetailTab('details')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                mobileDetailTab === 'details'
                  ? 'bg-[#06B6D4] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              aria-pressed={mobileDetailTab === 'details'}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setMobileDetailTab('comments')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                mobileDetailTab === 'comments'
                  ? 'bg-[#06B6D4] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              aria-pressed={mobileDetailTab === 'comments'}
            >
              Comments ({commentCount})
            </button>
          </div>
        )}
        <div className={isMobileViewport ? 'flex-1 min-h-0 overflow-hidden' : 'flex-1 grid min-h-0 grid-cols-1 overflow-hidden md:grid-cols-2'}>
          {isMobileViewport ? (
            isCreateFlow ? detailsSection : (mobileDetailTab === 'details' ? detailsSection : commentsSection)
          ) : (
            <>
              {detailsSection}
              {commentsSection}
            </>
          )}
        </div>

        {/* Activity sliding panel (from right of modal) */}
        {activityPanelOpen && (
          <>
            <div className="absolute inset-0 bg-black/30 z-10" onClick={() => setActivityPanelOpen(false)} aria-hidden />
            <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white rounded-l-2xl shadow-2xl flex flex-col z-20 animate-slide-in-right">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">Activity</h3>
                <button type="button" onClick={() => setActivityPanelOpen(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close activity panel" title="Close activity panel">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ul className="flex-1 overflow-y-auto p-4 space-y-2">
                {(taskDetail?.activity_log ?? []).slice(0, 50).map((entry) => (
                  <ActivityEntry key={entry.id} entry={entry} />
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Close with unsaved changes: Discard / Save */}
        {closeConfirmOpen && (
          <>
            <div className="absolute inset-0 bg-black/40 z-30" aria-hidden />
            <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-5 max-w-sm w-full">
                <p className="text-sm font-medium text-slate-900">You have unsaved changes.</p>
                <p className="text-xs text-slate-500 mt-1">Save or discard before closing?</p>
                <div className="flex gap-2 mt-4 justify-end">
                  <button
                    type="button"
                    onClick={handleCloseConfirmDiscard}
                    className="px-3 py-2 text-sm font-medium text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseConfirmSave}
                    className="px-3 py-2 text-sm font-medium text-white rounded-lg bg-[#06B6D4] hover:bg-[#0891b2] transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function renderCommentWithMentions(commentText: string, mentionedUsers: TaskAssignee[] = []) {
  if (!mentionedUsers.length) return <span className="whitespace-pre-wrap">{commentText}</span>
  const mentions = mentionedUsers
    .map((u) => ({ id: u.id, name: getUserName(u), displayName: getUserName(u) }))
    .filter((m) => m.name)
  if (!mentions.length) return <span className="whitespace-pre-wrap">{commentText}</span>
  const parts: Array<{ type: 'text'; value: string } | { type: 'mention'; name: string; displayName: string }> = []
  let text = commentText
  while (text.length > 0) {
    let best: { index: number; name: string; displayName: string } | null = null
    for (const m of mentions) {
      const needle = '@' + m.name
      const idx = text.indexOf(needle)
      if (idx !== -1 && (best === null || idx < best.index)) best = { index: idx, name: m.name, displayName: m.displayName }
    }
    if (best === null) {
      parts.push({ type: 'text', value: text })
      break
    }
    if (best.index > 0) parts.push({ type: 'text', value: text.slice(0, best.index) })
    parts.push({ type: 'mention', name: best.name, displayName: best.displayName })
    text = text.slice(best.index + ('@' + best.name).length)
  }
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.type === 'text' ? (
          <span key={i}>{p.value}</span>
        ) : (
          <span
            key={i}
            className="font-medium text-cyan-600"
            title={p.displayName}
          >
            @{p.displayName}
          </span>
        )
      )}
    </span>
  )
}

function CommentRow({
  comment,
  currentUserId,
  taskId,
  onUpdateComment,
  onDeleteComment,
  onDeleteCommentAttachment,
  getInitials,
}: {
  comment: TaskComment
  currentUserId: string | undefined
  taskId: string
  onUpdateComment: (taskId: string, commentId: string, text: string, mentionIds: string[]) => void
  onDeleteComment: (taskId: string, commentId: string) => void
  onDeleteCommentAttachment: (taskId: string, commentId: string, attachmentId: string) => Promise<void>
  getInitials: (name: string | null) => string
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.comment_text)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)
  const [attachmentMenuOpenId, setAttachmentMenuOpenId] = useState<string | null>(null)
  const isOwner = currentUserId !== undefined && comment.created_by === currentUserId
  useEffect(() => {
    setEditText(comment.comment_text)
    if (!editing) setDeleteConfirm(false)
  }, [comment.id, comment.comment_text, editing])

  useEffect(() => {
    if (!attachmentMenuOpenId) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Element)) {
        setAttachmentMenuOpenId(null)
        return
      }
      if (target.closest(`[data-comment-attachment-menu-id="${attachmentMenuOpenId}"]`)) return
      setAttachmentMenuOpenId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [attachmentMenuOpenId])

  useEffect(() => {
    if (!attachmentMenuOpenId) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAttachmentMenuOpenId(null)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [attachmentMenuOpenId])

  const handleSaveEdit = () => {
    const trimmed = editText.trim()
    if (!trimmed && comment.attachments.length === 0) return
    onUpdateComment(taskId, comment.id, trimmed, comment.mentioned_user_ids ?? [])
    setEditing(false)
  }

  const hasText = Boolean(comment.comment_text?.trim())

  return (
    <div className="group rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow transition-shadow overflow-hidden">
      <div className="flex gap-2.5 p-3.5">
        <div className="h-9 w-9 shrink-0 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center text-sm font-semibold">
          {getInitials(comment.created_by_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-900">
                {comment.created_by_role
                  ? `${comment.created_by_name} (${formatRoleLabel(comment.created_by_role)})`
                  : comment.created_by_name}
              </span>
              <span className="text-xs text-slate-400" title={comment.created_at}>
                {formatRelative(comment.created_at)}
              </span>
            </div>
            {isOwner && !editing && (
              <div className="flex items-center gap-0.5">
                <Tooltip content="Edit comment">
                  <button
                    type="button"
                    onClick={() => { setEditText(comment.comment_text); setEditing(true) }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50"
                    aria-label="Edit comment"
                    title="Edit comment"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.5-2.5l-7.586 7.586a2 2 0 01-2.828 0L5 12.828V11m8.586-8.586a2 2 0 012.828 0l2.828 2.828a2 2 0 010 2.828l-7.586 7.586" />
                    </svg>
                  </button>
                </Tooltip>
                <Tooltip content="Delete comment">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    aria-label="Delete comment"
                    title="Delete comment"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[72px] focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setEditText(comment.comment_text) }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {hasText ? (
                <p className="mt-1 text-sm text-slate-700">
                  {renderCommentWithMentions(comment.comment_text, comment.mentioned_users)}
                </p>
              ) : null}
              {comment.attachments.length > 0 && (
                <div className={`${hasText ? 'mt-2' : 'mt-1'} grid grid-cols-2 sm:grid-cols-3 gap-2`}>
                  {comment.attachments.map((attachment) => {
                    const isImage = isImageAttachment(attachment)
                    const extension = getTaskAttachmentFileExtension(attachment.file_name)
                    const isPdf = extension === 'pdf'
                    const deletingThis = deletingAttachmentId === attachment.id

                    return (
                      <div
                        key={attachment.id}
                        data-comment-attachment-menu-id={attachment.id}
                        className="group relative"
                      >
                        <a
                          href={attachment.cloudinary_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50"
                          aria-label={attachment.file_name}
                          title={attachment.file_name}
                        >
                          <div className="h-24 bg-slate-100">
                            {isImage ? (
                              <img
                                src={attachment.cloudinary_url}
                                alt={attachment.file_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2">
                                <svg className={`h-7 w-7 ${isPdf ? 'text-red-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-6-8h6M7 20h10a2 2 0 002-2V8l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                {extension ? (
                                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${isPdf ? 'bg-rose-50 text-rose-600' : 'bg-slate-200 text-slate-600'}`}>
                                    {extension}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                          <div className="border-t border-slate-200/80 bg-white px-2 py-1.5">
                            <p className="truncate text-xs font-medium text-slate-700" title={attachment.file_name}>
                              {attachment.file_name}
                            </p>
                          </div>
                        </a>
                        <div
                          className={`absolute right-1.5 top-1.5 z-10 transition-opacity ${
                            attachmentMenuOpenId === attachment.id ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setAttachmentMenuOpenId((id) => (id === attachment.id ? null : attachment.id))
                            }}
                            className="rounded-md border border-slate-200 bg-white/95 p-1 text-slate-600 shadow-sm hover:bg-white"
                            aria-label="Attachment actions"
                            title="Attachment actions"
                            aria-expanded={attachmentMenuOpenId === attachment.id}
                            aria-haspopup="true"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                            </svg>
                          </button>
                          {attachmentMenuOpenId === attachment.id && (
                            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                              <a
                                href={attachment.cloudinary_url}
                                download={attachment.file_name}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                onClick={() => setAttachmentMenuOpenId(null)}
                                aria-label="Download attachment"
                                title="Download attachment"
                              >
                                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download
                              </a>
                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setDeletingAttachmentId(attachment.id)
                                    try {
                                      await onDeleteCommentAttachment(taskId, comment.id, attachment.id)
                                      setAttachmentMenuOpenId(null)
                                    } finally {
                                      setDeletingAttachmentId(null)
                                    }
                                  }}
                                  disabled={deletingThis}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                  aria-label="Delete attachment"
                                  title="Delete attachment"
                                >
                                  {deletingThis ? (
                                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                  ) : (
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  )}
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {deleteConfirm && (
        <div className="px-3.5 pb-3.5 pt-0">
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 flex items-center justify-between gap-2">
            <span className="text-sm text-rose-800">Delete this comment?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { onDeleteComment(taskId, comment.id); setDeleteConfirm(false) }}
                className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActivityEntry({ entry }: { entry: TaskActivityLogEntry }) {
  const msg =
    entry.event_type === 'task_created'
      ? 'created this task'
      : entry.event_type === 'status_changed'
        ? `changed status ${entry.event_meta?.from ?? ''} → ${entry.event_meta?.to ?? ''}`
        : entry.event_type === 'assignees_updated'
          ? 'updated assignees'
          : entry.event_type === 'comment_added'
            ? 'added a comment'
            : entry.event_type === 'attachment_added'
              ? 'added attachment(s)'
              : entry.event_type === 'attachment_removed'
                ? 'removed an attachment'
                : entry.event_type === 'task_updated'
                  ? 'updated the task'
                  : entry.event_type
  return (
    <div className="flex gap-2 text-sm">
      <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">
        {getInitials(entry.created_by_name)}
      </div>
      <div>
        <span className="font-medium text-slate-700">{entry.created_by_name}</span>
        <span className="text-slate-500"> {msg}</span>
        <span className="text-xs text-slate-400 ml-1">{formatRelative(entry.created_at)}</span>
      </div>
    </div>
  )
}

function FilterDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  renderIcon,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  ariaLabel: string
  renderIcon?: (value: string) => ReactElement | null
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
        className={`${FILTER_DROPDOWN_TRIGGER_CLASSES} flex w-full items-center gap-2 text-left`}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {renderIcon?.(selectedOption.value)}
          <span className="truncate">{selectedOption.label}</span>
        </span>
        <svg
          className={`ml-auto h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 min-w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <ul role="listbox" aria-label={ariaLabel} className="max-h-56 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value
              return (
                <li key={option.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-cyan-50/80 font-medium text-cyan-800'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      {renderIcon?.(option.value)}
                      <span className="truncate">{option.label}</span>
                    </span>
                    {isSelected ? (
                      <svg className="ml-auto h-4 w-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function AssigneeSelect({
  value,
  options,
  onChange,
}: {
  value: string[]
  options: StaffSelectOption[]
  onChange: (ids: string[]) => void
}) {
  const selected = options.filter((o) => value.includes(o.id))
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[42px] w-full text-left hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]"
      >
        {selected.length === 0 ? (
          <span className="text-slate-400">Select assignees</span>
        ) : (
          <>
            {selected.map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-800"
              >
                {staffLabel(o)}
              </span>
            ))}
          </>
        )}
      </button>
      {open && (
        <>
          <div className="absolute inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-slate-200 bg-white shadow-xl py-1 max-h-48 overflow-y-auto">
            {options.map((o) => {
              const isSelected = value.includes(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      onChange(value.filter((id) => id !== o.id))
                    } else {
                      onChange([...value, o.id])
                    }
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                    isSelected ? 'bg-cyan-50 text-cyan-800' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 rounded border flex items-center justify-center text-xs ${
                      isSelected ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-slate-300'
                    }`}
                  >
                    {isSelected ? '✓' : ''}
                  </span>
                  {staffLabel(o)}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function TaskFormModal({
  projectId,
  mode,
  teamMembers,
  initialStatus,
  onSubmit,
  onClose,
  showError,
}: {
  projectId: string
  mode: 'create'
  teamMembers: StaffSelectOption[]
  initialStatus?: TaskStatus
  onSubmit: (p: {
    title: string
    description_html?: string | null
    task_type?: TaskType | null
    priority?: TaskPriority | null
    status?: TaskStatus | null
    due_date?: string | null
    assignee_ids?: string[]
    initial_files?: File[]
  }) => Promise<{ error: string | null }>
  onClose: () => void
  showError: (title: string, msg: string) => void
}) {
  const [title, setTitle] = useState('')
  const [descriptionHtml, setDescriptionHtml] = useState('')
  const [taskType, setTaskType] = useState<TaskType | ''>('feature')
  const [priority, setPriority] = useState<TaskPriority | ''>('medium')
  const [status, setStatus] = useState<TaskStatus>(initialStatus ?? 'todo')
  const [dueDate, setDueDate] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [initialFiles, setInitialFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false)
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const priorityDropdownRef = useRef<HTMLDivElement>(null)
  const typeDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (statusDropdownOpen && statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setStatusDropdownOpen(false)
      }
      if (priorityDropdownOpen && priorityDropdownRef.current && !priorityDropdownRef.current.contains(target)) {
        setPriorityDropdownOpen(false)
      }
      if (typeDropdownOpen && typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
        setTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [statusDropdownOpen, priorityDropdownOpen, typeDropdownOpen])

  const isDescriptionEmpty = (html: string) => {
    if (!html || !html.trim()) return true
    if (typeof document === 'undefined') return !html.replace(/<[^>]*>/g, '').trim()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const text = doc.body.textContent || ''
    return !text.trim()
  }

  const validateSelectedAttachmentFiles = (files: File[]) => {
    for (const file of files) {
      const validation = validateTaskAttachmentFile(file)
      if (!validation.ok) {
        showError(validation.title, validation.message)
        return false
      }
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDescriptionError(null)
    const t = title.trim()
    if (!t) {
      showError('Validation', 'Title is required.')
      return
    }
    if (isDescriptionEmpty(descriptionHtml)) {
      setDescriptionError('Description is required.')
      return
    }
    setSubmitting(true)
    await onSubmit({
      title: t,
      description_html: descriptionHtml || null,
      task_type: taskType || null,
      priority: priority || null,
      status,
      due_date: dueDate || null,
      assignee_ids: assigneeIds,
      initial_files: initialFiles.length > 0 ? initialFiles : undefined,
    })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">New Task</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 sm:p-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20"
              placeholder="Task title"
              required
            />
          </div>
          <div>
            <label htmlFor="new-task-description" className="block text-sm font-semibold text-slate-700 mb-1">
              Description <span className="text-red-500" aria-hidden>*</span>
            </label>
            <p className="text-xs text-slate-500 mb-2">Add details, acceptance criteria, or steps. Supports bold, lists, and formatting.</p>
            <ProjectTasksRichEditor
              id="new-task-description"
              value={descriptionHtml}
              onChange={(html) => {
                setDescriptionHtml(html)
                if (descriptionError && !isDescriptionEmpty(html)) setDescriptionError(null)
              }}
              minHeight="140px"
              placeholder="Describe the task…"
              error={!!descriptionError}
            />
            {descriptionError && (
              <p className="mt-1.5 text-sm text-red-600" role="alert">
                {descriptionError}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div ref={typeDropdownRef} className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Type</label>
              <button
                type="button"
                onClick={() => setTypeDropdownOpen((o) => !o)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-left flex items-center gap-2 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 focus:border-[#06B6D4] text-slate-700"
              >
                {taskType ? (
                  <>
                    <TaskTypeIcon type={taskType} />
                    <span>{TASK_TYPE_LABELS[taskType]}</span>
                  </>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
                <svg className="ml-auto h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {typeDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border border-slate-200 bg-white shadow-lg py-1 max-h-48 overflow-y-auto">
                  {(['feature', 'bug', 'improvement', 'research', 'other'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTaskType(t)
                        setTypeDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700 ${taskType === t ? 'bg-cyan-50/70' : ''}`}
                    >
                      <TaskTypeIcon type={t} />
                      {TASK_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={priorityDropdownRef} className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Priority</label>
              <button
                type="button"
                onClick={() => setPriorityDropdownOpen((o) => !o)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-left flex items-center gap-2 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 focus:border-[#06B6D4]"
              >
                <PriorityFlagIcon
                  className={`h-4 w-4 flex-shrink-0 ${priority ? TASK_PRIORITY_FLAG_COLORS[priority] : 'text-slate-300'}`}
                />
                <span>{priority ? TASK_PRIORITY_LABELS[priority] : '—'}</span>
                <svg className="ml-auto h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {priorityDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border border-slate-200 bg-white shadow-lg py-1 max-h-48 overflow-y-auto">
                  {(['urgent', 'high', 'medium', 'low'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPriority(p)
                        setPriorityDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 ${priority === p ? 'bg-cyan-50/70' : ''}`}
                    >
                      <PriorityFlagIcon className={`h-4 w-4 flex-shrink-0 ${TASK_PRIORITY_FLAG_COLORS[p]}`} />
                      {TASK_PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div ref={statusDropdownRef} className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
              <button
                type="button"
                onClick={() => setStatusDropdownOpen((o) => !o)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-left flex items-center gap-2 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 focus:border-[#06B6D4]"
              >
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${TASK_STATUS_DOT_COLORS[status]}`} aria-hidden />
                <span>{TASK_STATUS_LABELS[status]}</span>
                <svg className="ml-auto h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {statusDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border border-slate-200 bg-white shadow-lg py-1 max-h-48 overflow-y-auto">
                  {TASK_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setStatus(s)
                        setStatusDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 ${status === s ? 'bg-cyan-50/70' : ''}`}
                    >
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${TASK_STATUS_DOT_COLORS[s]}`} aria-hidden />
                      {TASK_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Assignees</label>
            <AssigneeSearchSelect
              value={assigneeIds}
              options={teamMembers}
              onChange={setAssigneeIds}
              placeholder="Search assignees…"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Attachments</label>
            <p className="text-xs text-slate-500 mb-2">Optional. Add files when creating the task (max {MAX_FILE_MB} MB per file).</p>
            <label className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">
              <input
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? [])
                  if (list.length > 0 && !validateSelectedAttachmentFiles(list)) {
                    e.target.value = ''
                    return
                  }
                  setInitialFiles((prev) => [...prev, ...list])
                  e.target.value = ''
                }}
              />
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8v8M4 12v8" />
              </svg>
              Add files
            </label>
            {initialFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {initialFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm">
                    <span className="truncate text-slate-700">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setInitialFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-rose-600 hover:text-rose-700 text-xs font-medium ml-2"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#06B6D4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0891b2] disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
