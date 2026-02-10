'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/components/ui/toast-context'
import { EmptyState } from '@/app/components/empty-state'
import { ProjectTasksRichEditor } from './project-tasks-rich-editor'
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
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
  }) => {
    const result = await createProjectTask(projectId, payload)
    if (result.error) {
      showError('Create failed', result.error)
      return result
    }
    showSuccess('Task created', 'New task has been added.')
    setCreateModalOpen(false)
    if (result.data) setTasks((prev) => [result.data!, ...prev])
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
    showSuccess('Task updated', 'Changes have been saved.')
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
            onClick={() => setCreateModalOpen(true)}
            className="rounded-xl bg-[#06B6D4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0891b2] transition-colors"
          >
            New Task
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

      {/* Main content: list or board + detail drawer/sheet */}
      <div className="flex-1 min-h-0 flex gap-3 mt-3">
        <div
          className={`overflow-auto flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50/30 ${
            selectedTaskId ? 'lg:max-w-[55%]' : ''
          }`}
        >
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading tasks…</div>
          ) : viewMode === 'list' ? (
            <ul className="divide-y divide-slate-200">
              {tasks.length === 0 ? (
                <li className="p-8">
                  <EmptyState
                    title="No tasks"
                    description="Create a task or adjust filters."
                  />
                </li>
              ) : (
                tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${TASK_STATUS_STYLES[task.status]}`}
                        >
                          {TASK_STATUS_LABELS[task.status]}
                        </span>
                        {task.priority && (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${TASK_PRIORITY_STYLES[task.priority]}`}
                          >
                            {TASK_PRIORITY_LABELS[task.priority]}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          {formatDate(task.due_date)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {task.assignees.slice(0, 3).map((a) => (
                        <div
                          key={a.id}
                          className="h-8 w-8 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center text-xs font-semibold"
                          title={a.full_name ?? a.email ?? ''}
                        >
                          {getInitials(a.full_name ?? a.email)}
                        </div>
                      ))}
                      {canUpdateStatus && (
                        <select
                          value={task.status}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleStatusChange(task.id, e.target.value as TaskStatus)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-lg border border-slate-200 text-xs py-1 px-2"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {TASK_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
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

        {/* Task detail: drawer (desktop) / sheet (mobile) */}
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
          />
        )}
      </div>

      {/* Create task modal */}
      {createModalOpen && (
        <TaskFormModal
          projectId={projectId}
          mode="create"
          teamMembers={teamMembers}
          onSubmit={handleCreateTask}
          onClose={() => setCreateModalOpen(false)}
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
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [commentText, setCommentText] = useState('')
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [showMentionPicker, setShowMentionPicker] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionAnchorIndex, setMentionAnchorIndex] = useState(-1)
  const [fileInputKey, setFileInputKey] = useState(0)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024

  useEffect(() => {
    if (taskDetail) {
      setTitleValue(taskDetail.title)
    }
  }, [taskDetail?.id, taskDetail?.title])

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
      <div className="hidden lg:flex w-[380px] flex-shrink-0 flex-col rounded-xl border border-slate-200 bg-white">
        <div className="p-6 flex items-center justify-between border-b">
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 text-sm text-slate-500">Loading…</div>
      </div>
    )
  }

  const content = (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {canEditTask && (
          <button
            type="button"
            onClick={onRequestDelete}
            className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Delete task"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div>
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
              }}
              className="w-full text-lg font-semibold text-slate-900 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]"
              autoFocus
            />
          ) : (
            <h2
              className="text-lg font-semibold text-slate-900 cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1"
              onClick={() => canEditTask && setEditingTitle(true)}
            >
              {taskDetail.title}
            </h2>
          )}
        </div>

        {/* Status & Priority */}
        <div className="flex flex-wrap gap-2">
          {canUpdateStatus && (
            <select
              value={taskDetail.status}
              onChange={(e) => onStatusChange(taskId, e.target.value as TaskStatus)}
              className={`rounded-lg border px-2 py-1 text-sm font-medium ${TASK_STATUS_STYLES[taskDetail.status]}`}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
          {taskDetail.priority && (
            <span
              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium border ${TASK_PRIORITY_STYLES[taskDetail.priority]}`}
            >
              {TASK_PRIORITY_LABELS[taskDetail.priority]}
            </span>
          )}
          {taskDetail.task_type && (
            <span className="text-xs text-slate-500 bg-slate-100 rounded px-2 py-1">
              {TASK_TYPE_LABELS[taskDetail.task_type]}
            </span>
          )}
        </div>

        {/* Assignees */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Assignees</p>
          {canEditTask ? (
            <AssigneeSelect
              value={taskDetail.assignees.map((a) => a.id)}
              options={teamMembers}
              onChange={(ids) => onAssigneesChange(taskId, ids)}
            />
          ) : (
            <div className="flex flex-wrap gap-1">
              {taskDetail.assignees.length === 0
                ? '—'
                : taskDetail.assignees.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-800"
                    >
                      {getInitials(a.full_name ?? a.email)}
                      {a.full_name ?? a.email}
                    </span>
                  ))}
            </div>
          )}
        </div>

        {/* Due date */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Due date</p>
          {canEditTask ? (
            <input
              type="date"
              value={taskDetail.due_date ?? ''}
              onChange={(e) =>
                onUpdateTask(taskId, {
                  due_date: e.target.value || null,
                })
              }
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          ) : (
            <p className="text-sm text-slate-700">{formatDate(taskDetail.due_date)}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Description</p>
          {canEditTask ? (
            <ProjectTasksRichEditor
              value={taskDetail.description_html ?? ''}
              onChange={(html) => onUpdateTask(taskId, { description_html: html })}
              minHeight="100px"
              editable={true}
            />
          ) : (
            <div
              className="prose prose-sm max-w-none text-slate-700 rounded-lg border border-slate-100 bg-slate-50/50 p-3 min-h-[60px]"
              dangerouslySetInnerHTML={{
                __html: taskDetail.description_html || '<p class="text-slate-400">No description</p>',
              }}
            />
          )}
        </div>

        {/* Attachments */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Attachments</p>
          <ul className="space-y-1">
            {taskDetail.attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2"
              >
                <a
                  href={a.cloudinary_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-cyan-700 hover:underline truncate flex-1"
                >
                  {a.file_name}
                </a>
                {canManageAttachments && (
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(a.id)}
                    className="text-rose-600 hover:text-rose-700 text-xs font-medium ml-2"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canManageAttachments && (
            <label className="mt-2 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">
              <input
                key={fileInputKey}
                type="file"
                accept={ACCEPTED_EXT}
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length === 0) return
                  const ok = await onUploadAttachments(taskId, files)
                  if (ok) setFileInputKey((k) => k + 1)
                  e.target.value = ''
                }}
              />
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8v8M4 12v8" />
              </svg>
              Upload (max {MAX_FILE_MB} MB per file)
            </label>
          )}
        </div>

        {/* Comments */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Comments</p>
          <div className="space-y-3">
            {taskDetail.comments.map((c) => (
              <CommentRow key={c.id} comment={c} />
            ))}
          </div>
          {userRole !== 'client' && (
            <div className="mt-3 relative">
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
                placeholder="Add a comment… Type @ to mention someone"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]"
                rows={3}
              />
              {showMentionPicker && filteredMentionUsers.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-slate-200 bg-white shadow-lg py-1 max-h-48 overflow-y-auto z-10">
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
                  className="rounded-lg bg-[#06B6D4] px-4 py-2 text-sm font-medium text-white hover:bg-[#0891b2] disabled:opacity-50"
                >
                  Post
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Activity log */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Activity</p>
          <ul className="space-y-2">
            {taskDetail.activity_log.slice(0, 20).map((entry) => (
              <ActivityEntry key={entry.id} entry={entry} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-black/50">
        <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
        <div className="absolute bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl bg-white shadow-xl flex flex-col animate-slide-up">
          <div className="h-1 w-12 bg-slate-200 rounded-full self-center mt-2 flex-shrink-0" />
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hidden lg:flex w-[400px] xl:w-[420px] flex-shrink-0 flex-col rounded-xl border border-slate-200 overflow-hidden">
      {content}
    </div>
  )
}

function CommentRow({ comment }: { comment: TaskComment }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
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
        className="flex flex-wrap gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[40px] w-full text-left"
      >
        {selected.length === 0 ? (
          <span className="text-slate-400">Select assignees</span>
        ) : (
          <>
            {selected.map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-800"
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
          <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border border-slate-200 bg-white shadow-lg py-1 max-h-48 overflow-y-auto">
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
  onSubmit,
  onClose,
  showError,
}: {
  projectId: string
  mode: 'create'
  teamMembers: StaffSelectOption[]
  onSubmit: (p: {
    title: string
    description_html?: string | null
    task_type?: TaskType | null
    priority?: TaskPriority | null
    status?: TaskStatus | null
    due_date?: string | null
    assignee_ids?: string[]
  }) => Promise<{ error: string | null }>
  onClose: () => void
  showError: (title: string, msg: string) => void
}) {
  const [title, setTitle] = useState('')
  const [descriptionHtml, setDescriptionHtml] = useState('')
  const [taskType, setTaskType] = useState<TaskType | ''>('')
  const [priority, setPriority] = useState<TaskPriority | ''>('medium')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [dueDate, setDueDate] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) {
      showError('Validation', 'Title is required.')
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
    })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
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
            <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
            <ProjectTasksRichEditor
              value={descriptionHtml}
              onChange={setDescriptionHtml}
              minHeight="100px"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Type</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType | '')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {(['feature', 'bug', 'improvement', 'research', 'other'] as const).map((t) => (
                  <option key={t} value={t}>
                    {TASK_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority | '')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {(['urgent', 'high', 'medium', 'low'] as const).map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
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
            <div className="flex flex-wrap gap-2">
              {teamMembers.map((m) => {
                const isSelected = assigneeIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setAssigneeIds((prev) =>
                        isSelected ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-sm font-medium border ${
                      isSelected
                        ? 'border-[#06B6D4] bg-cyan-50 text-cyan-800'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {staffLabel(m)}
                  </button>
                )
              })}
            </div>
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
