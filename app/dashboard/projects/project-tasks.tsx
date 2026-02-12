'use client'

import { useState, useEffect, useCallback, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/components/ui/toast-context'
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
  getTaskUploadSignature,
  createTaskAttachments,
  deleteTaskAttachment,
  getTaskMentionableUsers,
  type ProjectTaskListItem,
  type ProjectTaskDetail,
  type TaskComment,
  type TaskAttachment,
  type TaskActivityLogEntry,
  type TaskAssignee,
  type TaskFilters,
} from '@/lib/projects/tasks-actions'
import type { StaffSelectOption } from '@/lib/users/actions'

const MAX_FILE_MB = TASK_MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)
const ACCEPTED_EXT = TASK_ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')

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

function formatRelative(dateString: string) {
  const d = new Date(dateString)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

const TASK_TYPE_ICONS: Record<TaskType, JSX.Element> = {
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
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createModalDefaultStatus, setCreateModalDefaultStatus] = useState<TaskStatus | null>(null)
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<TaskStatus, boolean>>(() =>
    TASK_STATUSES.reduce((acc, s) => ({ ...acc, [s]: false }), {} as Record<TaskStatus, boolean>)
  )
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null)
  const [mentionableUsers, setMentionableUsers] = useState<TaskAssignee[]>([])

  const canUpdateStatus =
    canManageTasks || (userRole === 'staff' && Boolean(currentUserId))
  const canEditTask = canManageTasks
  const canManageAttachments = canManageTasks

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
    if (selectedTaskId) loadTaskDetail(selectedTaskId)
    else setTaskDetail(null)
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
    showSuccess('Task created', 'New task has been added.')
    setCreateModalOpen(false)
    if (result.data) setTasks((prev) => [result.data!, ...prev])
    const taskId = result.data?.id
    if (taskId && initial_files?.length) {
      const sigResult = await getTaskUploadSignature(projectId)
      if (sigResult.error || !sigResult.data) {
        showError('Upload failed', sigResult.error ?? 'Could not prepare upload.')
        router.refresh()
        return result
      }
      const signature = sigResult.data
      const uploaded: Array<{ file_name: string; mime_type: string; size_bytes: number; cloudinary_url: string; cloudinary_public_id: string; resource_type: string }> = []
      for (const file of initial_files) {
        if (file.size > TASK_MAX_ATTACHMENT_SIZE_BYTES) {
          showError('File too large', `${file.name} exceeds ${MAX_FILE_MB} MB.`)
          break
        }
        const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
        const mime = TASK_EXTENSION_MIME_MAP[ext]
        if (!mime) {
          showError('File type not allowed', `${file.name} is not a supported type.`)
          break
        }
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
            mime_type: file.type,
            size_bytes: file.size,
            cloudinary_url: data.secure_url,
            cloudinary_public_id: data.public_id,
            resource_type: data.resource_type ?? 'raw',
          })
        } catch {
          showError('Upload failed', `Could not upload ${file.name}.`)
          break
        }
      }
      if (uploaded.length > 0) {
        const createResult = await createTaskAttachments(taskId, uploaded)
        if (!createResult.error) {
          loadTasks()
          showSuccess('Attachments added', '')
        } else {
          showError('Save failed', createResult.error)
        }
      }
    }
    router.refresh()
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
    mentionIds: string[]
  ) => {
    const result = await createTaskComment(taskId, commentText, mentionIds)
    if (result.error) {
      showError('Comment failed', result.error)
      return
    }
    showSuccess('Comment added', '')
    if (result.data && taskDetail?.id === taskId) {
      setTaskDetail((prev) =>
        prev ? { ...prev, comments: [...prev.comments, result.data!] } : null
      )
    }
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
    const signature = sigResult.data
    const uploaded: Array<{
      file_name: string
      mime_type: string
      size_bytes: number
      cloudinary_url: string
      cloudinary_public_id: string
      resource_type: string
    }> = []
    for (const file of files) {
      if (file.size > TASK_MAX_ATTACHMENT_SIZE_BYTES) {
        showError('File too large', `${file.name} exceeds ${MAX_FILE_MB} MB.`)
        return false
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const mime = TASK_EXTENSION_MIME_MAP[ext]
      if (!mime) {
        showError('File type not allowed', `${file.name} is not a supported type.`)
        return false
      }
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', signature.apiKey)
      formData.append('timestamp', String(signature.timestamp))
      formData.append('signature', signature.signature)
      formData.append('folder', signature.folder)
      try {
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`,
          { method: 'POST', body: formData }
        )
        if (!res.ok) throw new Error('Upload failed')
        const data = await res.json()
        uploaded.push({
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          cloudinary_url: data.secure_url,
          cloudinary_public_id: data.public_id,
          resource_type: data.resource_type ?? 'raw',
        })
      } catch {
        showError('Upload failed', `Could not upload ${file.name}.`)
        return false
      }
    }
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

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Header: view toggle, search, filters, New Task */}
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-[#06B6D4] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm w-44 sm:w-56 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20"
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
              setCreateModalOpen(true)
            }}
            className="rounded-xl bg-[#06B6D4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0891b2] transition-colors"
          >
            + Add Task
          </button>
        )}
      </div>

      {/* Collapsible filters */}
      {filtersOpen && (
        <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.mine_only ?? false}
              onChange={(e) =>
                setFilters((f) => ({ ...f, mine_only: e.target.checked }))
              }
              className="rounded border-slate-300 text-[#06B6D4] focus:ring-[#06B6D4]"
            />
            <span className="text-sm font-medium text-slate-700">My tasks only</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Status</span>
            <select
              value={Array.isArray(filters.status) ? 'all' : (filters.status ?? 'all')}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  status: e.target.value === 'all' ? 'all' : (e.target.value as TaskStatus),
                }))
              }
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="all">All</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Priority</span>
            <select
              value={Array.isArray(filters.priority) ? 'all' : (filters.priority ?? 'all')}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  priority: e.target.value === 'all' ? 'all' : (e.target.value as TaskPriority),
                }))
              }
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="all">All</option>
              {(['urgent', 'high', 'medium', 'low'] as const).map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Type</span>
            <select
              value={Array.isArray(filters.task_type) ? 'all' : (filters.task_type ?? 'all')}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  task_type:
                    e.target.value === 'all' ? 'all' : (e.target.value as TaskType),
                }))
              }
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="all">All</option>
              {(['feature', 'bug', 'improvement', 'research', 'other'] as const).map(
                (t) => (
                  <option key={t} value={t}>
                    {TASK_TYPE_LABELS[t]}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      )}

      {/* Main content: list or board; task detail opens in modal overlay */}
      <div className="flex-1 min-h-0 flex mt-3 overflow-y-auto">
        <div className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50/30">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading tasks…</div>
          ) : viewMode === 'list' ? (
            <div className="p-3 space-y-4">
              {tasks.length === 0 ? (
                <div className="p-8">
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
                              setCreateModalOpen(true)
                            }}
                            className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
                          >
                            + Add Task
                          </button>
                        )}
                      </div>
                      {!isCollapsed && (
                        <div className="overflow-x-auto min-w-0 rounded-b-xl overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                <th className="px-3 py-2 w-[32%]">Name</th>
                                <th className="px-3 py-2 w-[110px]">Status</th>
                                <th className="px-3 py-2 w-[100px]">Assignee</th>
                                <th className="px-3 py-2 w-[90px]">Due date</th>
                                <th className="px-3 py-2 w-[90px]">Priority</th>
                                <th className="px-3 py-2 w-10" />
                              </tr>
                            </thead>
                            <tbody>
                              {sectionTasks.map((task) => (
                                <TaskListRow
                                  key={task.id}
                                  task={task}
                                  teamMembers={teamMembers}
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
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <div className="p-3 flex gap-3 overflow-x-auto h-full min-h-[400px]">
              {TASK_STATUSES.map((status) => (
                <div
                  key={status}
                  className="flex-shrink-0 w-72 rounded-xl bg-slate-100/80 border border-slate-200 flex flex-col"
                >
                  <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold rounded-full px-2 py-1 border ${TASK_STATUS_STYLES[status]}`}
                    >
                      {TASK_STATUS_LABELS[status]}
                    </span>
                    <span className="text-xs text-slate-500">
                      {tasksByStatus[status].length}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {tasksByStatus[status].map((task) => (
                      <div
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedTaskId(task.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedTaskId(task.id)
                          }
                        }}
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow cursor-pointer text-left"
                      >
                        <p className="font-medium text-slate-900 text-sm line-clamp-2">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {task.priority && (
                            <span
                              className={`text-[10px] font-medium rounded px-1.5 py-0.5 border ${TASK_PRIORITY_STYLES[task.priority]}`}
                            >
                              {TASK_PRIORITY_LABELS[task.priority]}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-[10px] text-slate-500">
                              {formatDate(task.due_date)}
                            </span>
                          )}
                          <div className="flex -space-x-1.5 ml-auto">
                            {task.assignees.slice(0, 2).map((a) => (
                              <div
                                key={a.id}
                                className="h-6 w-6 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center text-[10px] font-semibold border-2 border-white"
                                title={a.full_name ?? a.email ?? ''}
                              >
                                {getInitials(a.full_name ?? a.email)}
                              </div>
                            ))}
                          </div>
                        </div>
                        {canUpdateStatus && (
                          <select
                            value={task.status}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleStatusChange(task.id, e.target.value as TaskStatus)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 w-full rounded border border-slate-200 text-xs py-1 px-2"
                          >
                            {TASK_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {TASK_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Task detail: modal popup */}
        {selectedTaskId && (
          <TaskDetailPanel
            taskId={selectedTaskId}
            taskDetail={taskDetail}
            detailLoading={detailLoading}
            onClose={() => setSelectedTaskId(null)}
            userRole={userRole}
            canEditTask={canEditTask}
            canUpdateStatus={canUpdateStatus}
            canManageAttachments={canManageAttachments}
            currentUserId={currentUserId}
            teamMembers={teamMembers}
            mentionableUsers={mentionableUsers}
            onStatusChange={handleStatusChange}
            onUpdateTask={handleUpdateTask}
            onRequestDelete={() => setDeleteConfirmTaskId(selectedTaskId)}
            onAssigneesChange={handleAssigneesChange}
            onAddComment={handleAddComment}
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

      {/* Create task modal */}
      {createModalOpen && (
        <TaskFormModal
          projectId={projectId}
          mode="create"
          teamMembers={teamMembers}
          initialStatus={createModalDefaultStatus ?? undefined}
          onSubmit={handleCreateTask}
          onClose={() => { setCreateModalOpen(false); setCreateModalDefaultStatus(null) }}
          showError={showError}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirmTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900">Delete task?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This action cannot be undone.
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
  return o.full_name ?? o.email ?? o.id
}

function staffInitials(o: StaffSelectOption) {
  return getInitials(o.full_name ?? o.email ?? null)
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

function TaskListRow({
  task,
  teamMembers,
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
  teamMembers: StaffSelectOption[]
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
    .map((a) => teamMembers.find((m) => m.id === a.id))
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
      <td className="px-3 py-2">
        <span className="text-left font-medium text-slate-900 group-hover:text-[#06B6D4] truncate block w-full max-w-[200px]">
          {task.title}
        </span>
      </td>
      <td className="px-3 py-2">
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
      <td className="px-3 py-2">
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
                    {teamMembers.map((m) => {
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
      <td className="px-3 py-2">
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
      <td className="px-3 py-2">
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
      <td className="px-3 py-2">
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
  onClose,
  userRole,
  canEditTask,
  canUpdateStatus,
  canManageAttachments,
  currentUserId,
  teamMembers,
  mentionableUsers,
  onStatusChange,
  onUpdateTask,
  onRequestDelete,
  onAssigneesChange,
  onAddComment,
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
  onClose: () => void
  userRole: string
  canEditTask: boolean
  canUpdateStatus: boolean
  canManageAttachments: boolean
  currentUserId: string | undefined
  teamMembers: StaffSelectOption[]
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
  onAddComment: (taskId: string, text: string, mentionIds: string[]) => void
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
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [showMentionPicker, setShowMentionPicker] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionAnchorIndex, setMentionAnchorIndex] = useState(-1)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [activityPanelOpen, setActivityPanelOpen] = useState(false)
  const [detailDropdownOpen, setDetailDropdownOpen] = useState<'status' | 'assignee' | 'priority' | 'type' | null>(null)
  const [detailDropdownRect, setDetailDropdownRect] = useState<{ top: number; left: number } | null>(null)
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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailDropdownOpen(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [detailDropdownOpen])

  useEffect(() => {
    if (taskDetail) {
      setTitleValue(taskDetail.title)
    }
  }, [taskDetail?.id, taskDetail?.title])

  useEffect(() => {
    setPendingDescriptionHtml(null)
  }, [taskDetail?.id])

  const savedDescription = (taskDetail?.description_html ?? '').trim()
  const currentDescription = (pendingDescriptionHtml ?? savedDescription).trim()
  const descriptionDirty = canEditTask && pendingDescriptionHtml != null && currentDescription !== savedDescription

  const handleCloseRequest = () => {
    if (descriptionDirty) {
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
    await handleSaveDescription()
    setCloseConfirmOpen(false)
    onClose()
  }

  const filteredMentionUsers = mentionableUsers.filter((u) => {
    const name = (u.full_name ?? u.email ?? '').toLowerCase()
    const search = mentionSearch.toLowerCase()
    return name.includes(search)
  }).slice(0, 8)

  const handleCommentTextChange = (value: string) => {
    setCommentText(value)
    const lastAt = value.lastIndexOf('@')
    if (lastAt >= 0) {
      const after = value.slice(lastAt + 1)
      if (!/\s/.test(after)) {
        setShowMentionPicker(true)
        setMentionSearch(after)
        setMentionAnchorIndex(lastAt)
      } else {
        setShowMentionPicker(false)
      }
    } else {
      setShowMentionPicker(false)
    }
  }

  const handleMentionSelect = (user: TaskAssignee) => {
    const name = user.full_name ?? user.email ?? 'User'
    const before = mentionAnchorIndex > 0 ? commentText.slice(0, mentionAnchorIndex) : ''
    const after = commentText.slice(mentionAnchorIndex + 1 + mentionSearch.length)
    setCommentText(before + '@' + name + ' ' + after)
    setMentionIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]))
    setShowMentionPicker(false)
    setMentionSearch('')
  }

  const handleCommentSubmit = () => {
    const trimmed = commentText.trim()
    if (!trimmed) return
    onAddComment(taskId, trimmed, mentionIds)
    setCommentText('')
    setMentionIds([])
    setShowMentionPicker(false)
  }

  if (detailLoading || !taskDetail) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/20">
        <div className="flex flex-col w-full h-full max-h-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <span className="text-lg font-semibold text-slate-900">Task</span>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center text-slate-500">Loading…</div>
        </div>
      </div>
    )
  }

  const modalContent = (
    <>
      {/* Section 1: Description + Attachments (title is in top bar only) */}
      <div className="overflow-y-auto p-5 md:p-6 border-b md:border-b-0 md:border-r border-slate-200 min-h-0">
        {/* Description — full width with icon + label row */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-slate-600">Description</span>
          </div>
          {canEditTask ? (
            <ProjectTasksRichEditor
              value={pendingDescriptionHtml ?? taskDetail.description_html ?? ''}
              onChange={(html) => setPendingDescriptionHtml(html)}
              minHeight="120px"
              editable={true}
            />
          ) : (
            <div
              className="prose prose-sm max-w-none text-slate-700 rounded-xl border border-slate-200 bg-slate-50/30 p-4 min-h-[80px]"
              dangerouslySetInnerHTML={{
                __html: taskDetail.description_html || '<p class="text-slate-400">No description</p>',
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
            {taskDetail.attachments.length > 0 && (
              <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                {taskDetail.attachments.length}
              </span>
            )}
          </div>

          {canManageAttachments && (
            <label
              className="flex items-center justify-center gap-2 h-[60px] min-h-[60px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 cursor-pointer transition-colors hover:border-[#06B6D4]/50 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-[#06B6D4]/30 focus-within:border-[#06B6D4]"
            >
              <input
                key={fileInputKey}
                type="file"
                accept={ACCEPTED_EXT}
                multiple
                className="sr-only"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length === 0) return
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

          {taskDetail.attachments.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {taskDetail.attachments.map((a) => (
                <div
                  key={a.id}
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
                    {/* Hover overlay: View + Delete */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={a.cloudinary_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-full bg-white/90 text-slate-700 hover:bg-white hover:text-cyan-600 transition-colors"
                        aria-label="View attachment"
                        title="View"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7C7.523 19 3.732 16.057 2.458 12z" />
                        </svg>
                      </a>
                      {canManageAttachments && (
                        <button
                          type="button"
                          onClick={() => onRemoveAttachment(a.id)}
                          className="p-2.5 rounded-full bg-white/90 text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          aria-label="Delete attachment"
                          title="Delete"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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

      {/* Section 2: Comments + Activity */}
      <div className="overflow-y-auto p-5 md:p-6 min-h-0 flex flex-col">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider pb-3 border-b border-slate-200 mb-4">
          Comments & activity
        </h3>
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          <div>
            <div className="space-y-3">
              {taskDetail.comments.map((c) => (
                <CommentRow key={c.id} comment={c} />
              ))}
            </div>
            {userRole !== 'client' && (
              <div className="mt-4 relative">
                <textarea
                  value={commentText}
                  onChange={(e) => handleCommentTextChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleCommentSubmit()
                    }
                    if (e.key === 'Escape') setShowMentionPicker(false)
                  }}
                  placeholder="Add a comment… Type @ to mention"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm min-h-[88px] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]"
                  rows={3}
                />
                {showMentionPicker && filteredMentionUsers.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-slate-200 bg-white shadow-xl py-1 max-h-48 overflow-y-auto z-10">
                    {filteredMentionUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleMentionSelect(u)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-cyan-50 flex items-center gap-2"
                      >
                        <span className="h-7 w-7 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center text-xs font-semibold">
                          {getInitials(u.full_name ?? u.email)}
                        </span>
                        {u.full_name ?? u.email ?? u.id}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCommentSubmit}
                    disabled={!commentText.trim()}
                    className="rounded-xl bg-[#06B6D4] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0891b2] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
                  >
                    Post comment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/20" onClick={(e) => e.target === e.currentTarget && handleCloseRequest()}>
      <div className="relative flex flex-col w-full h-full max-h-full bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header: Task details + title (editable) + actions */}
        <header className="flex-shrink-0 bg-slate-50/50 border-b border-slate-200">
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0 border-b-2 border-[#06B6D4] pb-0.5">Task details</span>
              {editingTitle && canEditTask ? (
                <input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={async () => {
                    setEditingTitle(false)
                    if (titleValue.trim() !== taskDetail.title) {
                      await onUpdateTask(taskId, { title: titleValue.trim() })
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setEditingTitle(false)
                      if (titleValue.trim() !== taskDetail.title) {
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
              {descriptionDirty && (
                <button type="button" onClick={handleSaveDescription} className="p-2 rounded-xl text-cyan-600 hover:bg-cyan-50 transition-colors" aria-label="Save description" title="Save">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                </button>
              )}
              <button type="button" onClick={() => setActivityPanelOpen(true)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors" aria-label="Activity" title={`Activity (${taskDetail.activity_log.length})`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {canEditTask && (
                <button type="button" onClick={onRequestDelete} className="p-2 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors" aria-label="Delete task" title="Delete task">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button type="button" onClick={handleCloseRequest} className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors" aria-label="Close" title="Close">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="px-5 pb-4 pt-3 border-t border-slate-200/80">
            {/* Same compact row as Task List View: Status | Assignees | Due date | Priority | Type */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status — list row style */}
              {canUpdateStatus ? (
                <div className="relative inline-block">
                  <button
                    ref={detailStatusRef}
                    type="button"
                    onClick={() => setDetailDropdownOpen((o) => (o === 'status' ? null : 'status'))}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
                    title="Change status"
                  >
                    <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT_COLORS[taskDetail.status] ?? 'bg-slate-400'}`} />
                    <span>{TASK_STATUS_LABELS[taskDetail.status] ?? taskDetail.status}</span>
                  </button>
                  {detailDropdownOpen === 'status' && detailDropdownRect && typeof document !== 'undefined' &&
                    createPortal(
                      <>
                        <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setDetailDropdownOpen(null)} />
                        <div data-detail-dropdown className="fixed z-[9999] w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1" style={{ top: detailDropdownRect.top, left: detailDropdownRect.left }}>
                          {TASK_STATUSES.map((s) => (
                            <button key={s} type="button" onClick={() => { onStatusChange(taskId, s); setDetailDropdownOpen(null) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
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
                  <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT_COLORS[taskDetail.status] ?? 'bg-slate-400'}`} />
                  {TASK_STATUS_LABELS[taskDetail.status] ?? taskDetail.status}
                </span>
              )}

              {/* Assignees — list row style (avatar stack + dropdown) */}
              {(() => {
                const assigneeIds = taskDetail.assignees.map((a) => a.id)
                const assigneeOptions = teamMembers.filter((m) => assigneeIds.includes(m.id))
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
                              {teamMembers.map((m) => {
                                const isSelected = assigneeIds.includes(m.id)
                                const color = getAssigneeColor(m.id)
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      onAssigneesChange(taskId, isSelected ? assigneeIds.filter((id) => id !== m.id) : [...assigneeIds, m.id])
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

              {/* Due date — list row style */}
              {canEditTask ? (
                <div className="relative inline-block">
                  <input
                    ref={detailDueInputRef}
                    type="date"
                    value={taskDetail.due_date ?? ''}
                    onChange={(e) => onUpdateTask(taskId, { due_date: e.target.value || null })}
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
                    {taskDetail.due_date ? formatDate(taskDetail.due_date) : '—'}
                  </button>
                </div>
              ) : (
                <span className="text-slate-600 text-xs">{taskDetail.due_date ? formatDate(taskDetail.due_date) : '—'}</span>
              )}

              {/* Priority — list row style */}
              {canEditTask ? (
                <div className="relative inline-block">
                  <button
                    ref={detailPriorityRef}
                    type="button"
                    onClick={() => setDetailDropdownOpen((o) => (o === 'priority' ? null : 'priority'))}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 ${
                      taskDetail.priority
                        ? `border-slate-200/80 ${TASK_PRIORITY_STYLES[taskDetail.priority]}`
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                    title="Change priority"
                  >
                    <PriorityFlagIcon className={`h-4 w-4 flex-shrink-0 ${taskDetail.priority ? TASK_PRIORITY_FLAG_COLORS[taskDetail.priority] : 'text-slate-400'}`} />
                    <span>{taskDetail.priority ? TASK_PRIORITY_LABELS[taskDetail.priority] : '—'}</span>
                  </button>
                  {detailDropdownOpen === 'priority' && detailDropdownRect && typeof document !== 'undefined' &&
                    createPortal(
                      <>
                        <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setDetailDropdownOpen(null)} />
                        <div data-detail-dropdown className="fixed z-[9999] w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1" style={{ top: detailDropdownRect.top, left: detailDropdownRect.left }}>
                          {TASK_PRIORITIES.map((p) => (
                            <button key={p} type="button" onClick={() => { onUpdateTask(taskId, { priority: p }); setDetailDropdownOpen(null) }} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-sky-50 ${taskDetail.priority === p ? 'bg-sky-50' : ''}`}>
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
                <span className={`inline-flex items-center gap-1.5 text-xs ${taskDetail.priority ? TASK_PRIORITY_STYLES[taskDetail.priority] : 'text-slate-400'}`}>
                  {taskDetail.priority && <PriorityFlagIcon className={`h-4 w-4 ${TASK_PRIORITY_FLAG_COLORS[taskDetail.priority]}`} />}
                  {taskDetail.priority ? TASK_PRIORITY_LABELS[taskDetail.priority] : '—'}
                </span>
              )}

              {/* Type — same pill style as list (detail-only field) */}
              {canEditTask ? (
                <div className="relative inline-block">
                  <button
                    ref={detailTypeRef}
                    type="button"
                    onClick={() => setDetailDropdownOpen((o) => (o === 'type' ? null : 'type'))}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
                    title="Change type"
                  >
                    {taskDetail.task_type ? <TaskTypeIcon type={taskDetail.task_type} className="h-4 w-4 flex-shrink-0 text-slate-500" /> : null}
                    <span>{taskDetail.task_type ? TASK_TYPE_LABELS[taskDetail.task_type] : '—'}</span>
                  </button>
                  {detailDropdownOpen === 'type' && detailDropdownRect && typeof document !== 'undefined' &&
                    createPortal(
                      <>
                        <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setDetailDropdownOpen(null)} />
                        <div data-detail-dropdown className="fixed z-[9999] w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1" style={{ top: detailDropdownRect.top, left: detailDropdownRect.left }}>
                          {TASK_TYPES.map((t) => (
                            <button key={t} type="button" onClick={() => { onUpdateTask(taskId, { task_type: t }); setDetailDropdownOpen(null) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
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
                taskDetail.task_type ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                    <TaskTypeIcon type={taskDetail.task_type} className="h-4 w-4 text-slate-500" />
                    {TASK_TYPE_LABELS[taskDetail.task_type]}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )
              )}
            </div>
          </div>
        </header>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0 overflow-hidden">
          {modalContent}
        </div>

        {/* Activity sliding panel (from right of modal) */}
        {activityPanelOpen && (
          <>
            <div className="absolute inset-0 bg-black/30 z-10" onClick={() => setActivityPanelOpen(false)} aria-hidden />
            <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white rounded-l-2xl shadow-2xl flex flex-col z-20 animate-slide-in-right">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">Activity</h3>
                <button type="button" onClick={() => setActivityPanelOpen(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ul className="flex-1 overflow-y-auto p-4 space-y-2">
                {taskDetail.activity_log.slice(0, 50).map((entry) => (
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

function CommentRow({ comment }: { comment: TaskComment }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center text-xs font-semibold">
          {getInitials(comment.created_by_name)}
        </div>
        <span className="text-sm font-medium text-slate-800">{comment.created_by_name}</span>
        <span className="text-xs text-slate-400">{formatRelative(comment.created_at)}</span>
      </div>
      <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{comment.comment_text}</p>
      {comment.mentioned_users?.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          Mentioned: {comment.mentioned_users.map((u) => u.full_name ?? u.email).join(', ')}
        </p>
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
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">New Task</h2>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
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
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
                accept={ACCEPTED_EXT}
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? [])
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
