'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import {
  Project,
  ProjectStatus,
  ProjectFollowUp,
  ProjectPriority,
  getProject,
  updateProject,
  updateProjectLinks,
  updateProjectStatus,
  updateMyProjectWorkStatus,
  deleteProject,
  ProjectFormData,
} from '@/lib/projects/actions'
import type { ProjectTeamMember, ProjectTeamMemberWorkStatus } from '@/lib/projects/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'
import type { StaffSelectOption } from '@/lib/users/actions'
import { ProjectDetailRightPanel } from '../project-detail-right-panel'
import { ProjectModal } from '../project-modal'
import { DeleteConfirmModal } from '../delete-confirm-modal'

interface ProjectDetailViewProps {
  project: Project
  initialFollowUps?: ProjectFollowUp[]
  canManageProject: boolean
  canManageFollowUps: boolean
  canViewAmount: boolean
  userRole: string
  currentUserId?: string
  clients: ClientSelectOption[]
  clientsError: string | null
  technologyTools: TechnologyTool[]
  technologyToolsError: string | null
  teamMembers: StaffSelectOption[]
  teamMembersError: string | null
}

const STATUS_STYLES: Record<ProjectStatus, string> = {
  pending: 'bg-slate-200 text-slate-800 border-slate-300 ring-1 ring-slate-300/50',
  in_progress: 'bg-sky-200 text-sky-900 border-sky-400 ring-1 ring-sky-400/50',
  hold: 'bg-amber-200 text-amber-900 border-amber-400 ring-1 ring-amber-400/50',
  completed: 'bg-emerald-200 text-emerald-900 border-emerald-500 ring-1 ring-emerald-500/50',
}
const STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  hold: 'Hold',
  completed: 'Completed',
}

function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function StatusSegment({
  status,
  onStatusChange,
  disabled,
}: {
  status: ProjectStatus
  onStatusChange: (next: ProjectStatus) => void
  disabled?: boolean
}) {
  const handleSelect = (next: ProjectStatus) => {
    if (next !== status && !disabled) {
      onStatusChange(next)
    }
  }

  const segmentButtons: { status: ProjectStatus; label: string; icon: React.ReactNode }[] = [
    {
      status: 'pending',
      label: 'Pending',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      status: 'in_progress',
      label: 'In Progress',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      status: 'hold',
      label: 'Hold',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      status: 'completed',
      label: 'Completed',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div
      className="inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-50/50 p-1 shadow-sm"
      role="group"
      aria-label="Project status"
    >
      {segmentButtons.map(({ status: s, label, icon }) => {
        const isSelected = s === status
        const button = (
          <button
            type="button"
            onClick={() => handleSelect(s)}
            disabled={disabled}
            aria-pressed={isSelected}
            aria-label={label}
            className={`
              flex items-center justify-center w-10 h-10 rounded-lg
              transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1
              ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
              ${isSelected
                ? `${STATUS_STYLES[s]} border shadow-sm ring-1 ring-black/5`
                : 'text-slate-500 hover:bg-white hover:text-slate-700 hover:border-slate-200 border border-transparent'}
            `}
          >
            {icon}
          </button>
        )
        return (
          <Tooltip key={s} content={label}>
            {button}
          </Tooltip>
        )
      })}
    </div>
  )
}

function PriorityPill({ priority }: { priority: ProjectPriority }) {
  const priorityStyles = {
    urgent: 'bg-rose-200 text-rose-900 border-rose-400',
    high: 'bg-orange-200 text-orange-900 border-orange-400',
    medium: 'bg-slate-200 text-slate-800 border-slate-300',
    low: 'bg-emerald-200 text-emerald-800 border-emerald-400',
  }
  const priorityLabels = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border ${priorityStyles[priority]}`}>
      {priorityLabels[priority]}
    </span>
  )
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '--'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatWorkStatus(status: ProjectTeamMemberWorkStatus | undefined) {
  if (!status || status === 'not_started') return 'Not started'
  if (status === 'start') return 'In progress'
  if (status === 'hold') return 'On hold'
  return 'Ended'
}

function formatWorkSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h < 24) return rem > 0 ? `${h}h ${rem}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`
}

function parseLinks(value: string | null) {
  if (!value) return []
  return value
    .split(',')
    .map((link) => link.trim())
    .filter(Boolean)
}

function normalizeLink(url: string) {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

export function ProjectDetailView({
  project: initialProject,
  initialFollowUps = [],
  canManageProject,
  canManageFollowUps,
  canViewAmount,
  userRole,
  currentUserId,
  clients,
  clientsError,
  technologyTools,
  technologyToolsError,
  teamMembers,
  teamMembersError,
}: ProjectDetailViewProps) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const [project, setProject] = useState<Project>(initialProject)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [linksModalOpen, setLinksModalOpen] = useState(false)
  const [editWebsiteLinks, setEditWebsiteLinks] = useState('')
  const [editReferenceLinks, setEditReferenceLinks] = useState('')
  const [linksUpdating, setLinksUpdating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mobileFollowUpsOpen, setMobileFollowUpsOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [myWorkStatusUpdating, setMyWorkStatusUpdating] = useState(false)
  const [endWorkModalOpen, setEndWorkModalOpen] = useState(false)
  const [endWorkNotes, setEndWorkNotes] = useState('')
  /** Optimistic work state so the timer shows immediately on Start without waiting for server */
  const [optimisticWork, setOptimisticWork] = useState<{ status: 'start'; runningSince: string } | null>(null)

  const canUpdateOwnWork = Boolean(
    currentUserId &&
      userRole !== 'client' &&
      project.team_members?.some((m) => m.id === currentUserId)
  )

  const handleMyWorkStatus = async (eventType: 'start' | 'hold' | 'resume' | 'end', note?: string) => {
    if (!currentUserId || myWorkStatusUpdating) return
    if (eventType === 'start') {
      setOptimisticWork({ status: 'start', runningSince: new Date().toISOString() })
    }
    setMyWorkStatusUpdating(true)
    const result = await updateMyProjectWorkStatus(project.id, eventType, note || undefined)
    setMyWorkStatusUpdating(false)
    setOptimisticWork(null)
    setEndWorkModalOpen(false)
    setEndWorkNotes('')
    if (!result.error && result.data) {
      setProject(result.data)
      showSuccess('Work Status Updated', eventType === 'end' ? 'Work ended and notes saved.' : 'Status updated.')
      router.refresh()
    } else {
      showError('Update Failed', result.error || 'Failed to update work status')
    }
  }

  const canEdit = canManageProject
  const canDelete = canManageProject
  const canEditClientStatus = userRole === 'admin' || userRole === 'manager'
  const canEditLinks = userRole === 'admin' || userRole === 'manager'

  const openLinksModal = () => {
    setEditWebsiteLinks(project.website_links?.split(',').map((s) => s.trim()).filter(Boolean).join('\n') ?? '')
    setEditReferenceLinks(project.reference_links?.split(',').map((s) => s.trim()).filter(Boolean).join('\n') ?? '')
    setLinksModalOpen(true)
  }

  const linksToStored = (text: string) =>
    text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ') || null

  const handleSaveLinks = async () => {
    setLinksUpdating(true)
    const result = await updateProjectLinks(project.id, {
      website_links: linksToStored(editWebsiteLinks),
      reference_links: linksToStored(editReferenceLinks),
    })
    setLinksUpdating(false)
    if (!result.error) {
      setProject((prev) => ({
        ...prev,
        website_links: linksToStored(editWebsiteLinks),
        reference_links: linksToStored(editReferenceLinks),
      }))
      setLinksModalOpen(false)
      showSuccess('Links updated', 'Website and reference links have been saved.')
      router.refresh()
    } else {
      showError('Update failed', result.error)
    }
  }

  const handleEditSuccess = async () => {
    setLoading(true)
    const result = await getProject(project.id)
    setLoading(false)
    if (result && 'data' in result && result.data) {
      setProject(result.data as Project)
    }
    setEditModalOpen(false)
    router.refresh()
  }

  const handleDelete = () => {
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    const result = await deleteProject(project.id)
    setDeleting(false)

    if (!result.error) {
      router.push('/dashboard/projects')
    } else {
      showError('Delete Failed', result.error || 'Failed to delete project')
      setDeleteModalOpen(false)
    }
  }

  const handleCloseDelete = () => {
    setDeleteModalOpen(false)
  }

  const handleClientStatusChange = async (nextStatus: ProjectStatus) => {
    if (nextStatus === project.status || statusUpdating) return
    setStatusUpdating(true)
    const result = await updateProjectStatus(project.id, nextStatus)
    setStatusUpdating(false)

    if (!result.error && result.data) {
      setProject(result.data)
      showSuccess('Status Updated', 'Client status has been updated.')
      router.refresh()
    } else {
      showError('Update Failed', result.error || 'Failed to update client status')
    }
  }

  const getInitialEditData = (): ProjectFormData => {
    return {
      name: project.name,
      logo_url: project.logo_url || undefined,
      client_id: project.client_id,
      project_amount: project.project_amount ?? undefined,
      priority: project.priority ?? 'medium',
      start_date: project.start_date,
      developer_deadline_date: project.developer_deadline_date ?? undefined,
      client_deadline_date: project.client_deadline_date ?? undefined,
      website_links: project.website_links ?? undefined,
      reference_links: project.reference_links ?? undefined,
      technology_tool_ids: project.technology_tools?.map((tool) => tool.id) ?? [],
      team_member_ids: project.team_members?.map((member) => member.id) ?? [],
    }
  }

  const handleEdit = () => {
    if (!canEdit) {
      showError('Read-only Access', 'You do not have permission to edit projects.')
      return
    }
    setEditModalOpen(true)
  }

  const clientLabel = project.client
    ? project.client.company_name
      ? `${project.client.name} (${project.client.company_name})`
      : project.client.name
    : '--'

  const websiteLinks = parseLinks(project.website_links)
  const referenceLinks = parseLinks(project.reference_links)

  const staffMember = userRole === 'staff' && currentUserId
    ? project.team_members?.find((m) => m.id === currentUserId)
    : null
  const staffWorkState = staffMember
    ? {
        status: (optimisticWork?.status ?? staffMember.work_status ?? 'not_started') as 'not_started' | 'start' | 'hold' | 'end',
        runningSince: optimisticWork?.status === 'start' ? optimisticWork.runningSince : (staffMember.work_running_since ?? null),
        totalSeconds: optimisticWork?.status === 'start' ? 0 : (staffMember.total_work_seconds ?? 0),
        isUpdating: myWorkStatusUpdating,
      }
    : null

  return (
    <>
      <div className="flex h-full flex-col lg:flex-row gap-3">
        {/* LEFT COLUMN: Project Details */}
        <div className="w-full lg:w-2/5 flex flex-col gap-3 overflow-y-auto pb-24 lg:pb-0 scrollbar-hide">
          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 relative">
            <div className="px-4 pt-4 pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Project Details</h2>
            </div>
            <div className="relative bg-white border-b border-gray-100 p-4 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-5">
                  {project.logo_url ? (
                    <img
                      src={project.logo_url}
                      alt={project.name}
                      className="h-20 w-20 rounded-2xl object-cover shadow-xl ring-2 ring-white"
                    />
                  ) : (
                    <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                      <span className="text-3xl font-extrabold text-white drop-shadow-sm">
                        {getInitials(project.name)}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-extrabold text-[#1E1B4B] mb-3 truncate" title={project.name}>{project.name}</h1>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                        {canEditClientStatus ? (
                          <StatusSegment
                            status={project.status}
                            onStatusChange={handleClientStatusChange}
                            disabled={statusUpdating}
                          />
                        ) : (
                          <StatusPill status={project.status} />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Priority</span>
                        <PriorityPill priority={project.priority} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {canEdit && (
                    <Tooltip content="Edit project">
                      <button
                        type="button"
                        onClick={handleEdit}
                        className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-1 cursor-pointer"
                        aria-label="Edit project"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip content="Delete project">
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:ring-offset-1 cursor-pointer"
                        aria-label="Delete project"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userRole !== 'staff' && (
                  project.client?.id ? (
                    <Link
                      href={`/dashboard/clients/${project.client.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/30 transition-colors cursor-pointer group"
                    >
                      <div className="h-12 w-12 rounded-xl bg-cyan-50 flex items-center justify-center group-hover:bg-cyan-200 group-hover:scale-105 transition-all duration-200">
                        <svg className="h-6 w-6 text-cyan-600 group-hover:text-cyan-700 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</p>
                        <p className="text-sm font-semibold text-slate-700 group-hover:text-cyan-700 line-clamp-2">{clientLabel}</p>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200">
                      <div className="h-12 w-12 rounded-xl bg-cyan-50 flex items-center justify-center">
                        <svg className="h-6 w-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</p>
                        <p className="text-sm font-semibold text-slate-700 line-clamp-2">{clientLabel}</p>
                      </div>
                    </div>
                  )
                )}

                <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200">
                  <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
                    <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Start Date</p>
                    <p className="text-sm font-semibold text-slate-700">{formatDate(project.start_date)}</p>
                  </div>
                </div>

                {canViewAmount && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200">
                    <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Project Amount</p>
                      <p className="text-sm font-semibold text-slate-700">{formatCurrency(project.project_amount)}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200">
                  <div className="h-12 w-12 rounded-xl bg-cyan-50 flex items-center justify-center">
                    <svg className="h-6 w-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Project Deadline</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {project.developer_deadline_date ? formatDate(project.developer_deadline_date) : '--'}
                    </p>
                  </div>
                </div>

                {userRole !== 'staff' && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200">
                    <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
                      <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Client Deadline</p>
                      <p className="text-sm font-semibold text-slate-700">
                        {project.client_deadline_date ? formatDate(project.client_deadline_date) : '--'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200">
                  <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center">
                    <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</p>
                    <p className="text-sm font-semibold text-slate-700">{formatDate(project.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {userRole !== 'staff' && (
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#1E1B4B]">Payment Summary</h3>
              </div>
              {canViewAmount ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Amount</p>
                    <p className="mt-2 text-lg font-bold text-slate-800">{formatCurrency(project.project_amount)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Paid</p>
                    <p className="mt-2 text-lg font-bold text-slate-800">{formatCurrency(0)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding</p>
                    <p className="mt-2 text-lg font-bold text-slate-800">{formatCurrency(project.project_amount)}</p>
                  </div>
                  <p className="text-xs text-slate-500 sm:col-span-3">
                    Payment tracking details will populate here once payments are recorded.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Payment summary is visible only to admins and managers.
                </div>
              )}
            </div>
          )}

          {/* Admin/Manager: Team Members. Staff: no "Your work" section (actions are in Work history tab). */}
          {userRole !== 'staff' && (
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#1E1B4B]">Team Members</h3>
              </div>
              {project.team_members && project.team_members.length > 0 ? (
                <div className="space-y-4">
                  {project.team_members.map((member: ProjectTeamMember) => {
                    const status = member.work_status ?? 'not_started'
                    const isMe = currentUserId === member.id
                    const totalSec = member.total_work_seconds ?? 0
                    const runningSince = member.work_running_since
                    const isRunning = status === 'start' && runningSince
                    const currentMs = Date.now()
                    const elapsedSec = isRunning && runningSince
                      ? (currentMs - new Date(runningSince).getTime()) / 1000 + totalSec
                      : totalSec
                    const statusStyles: Record<string, string> = {
                      not_started: 'bg-slate-100 text-slate-600 border-slate-200',
                      start: 'bg-cyan-100 text-cyan-800 border-cyan-200',
                      hold: 'bg-amber-100 text-amber-800 border-amber-200',
                      end: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    }
                    const statusStyle = statusStyles[status] || statusStyles.not_started
                    return (
                      <div
                        key={member.id}
                        className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              {member.full_name || member.email || 'Staff Member'}
                            </span>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyle}`}>
                              {formatWorkStatus(status)}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-slate-700 tabular-nums">
                            {status === 'not_started'
                              ? '--'
                              : formatWorkSeconds(elapsedSec) + (isRunning ? ' (in progress)' : '')}
                          </div>
                        </div>
                        {status === 'end' && member.work_done_notes && (
                          <div className="rounded-lg bg-white border border-slate-100 p-2 text-xs text-slate-600">
                            <span className="font-semibold text-slate-500">Done points: </span>
                            {member.work_done_notes}
                          </div>
                        )}
                        {canUpdateOwnWork && isMe && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {(status === 'not_started' || status === 'end') && (
                              <button
                                type="button"
                                onClick={() => handleMyWorkStatus('start')}
                                disabled={myWorkStatusUpdating}
                                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 cursor-pointer transition-colors"
                              >
                                {status === 'end' ? 'Start again' : 'Start'}
                              </button>
                            )}
                            {status === 'start' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMyWorkStatus('hold')}
                                  disabled={myWorkStatusUpdating}
                                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer transition-colors"
                                >
                                  Hold
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEndWorkModalOpen(true)}
                                  disabled={myWorkStatusUpdating}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
                                >
                                  End
                                </button>
                              </>
                            )}
                            {status === 'hold' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMyWorkStatus('resume')}
                                  disabled={myWorkStatusUpdating}
                                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 cursor-pointer transition-colors"
                                >
                                  Resume
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEndWorkModalOpen(true)}
                                  disabled={myWorkStatusUpdating}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
                                >
                                  End
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  No team members assigned.
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1E1B4B]">Technology & Tools</h3>
            </div>
            {project.technology_tools && project.technology_tools.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {project.technology_tools.map((tool) => (
                  <span
                    key={tool.id}
                    className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700"
                  >
                    {tool.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No tools selected yet.</p>
            )}
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1E1B4B]">Website Links</h3>
              {canEditLinks && (
                <Tooltip content="Edit website and reference links">
                  <button
                    type="button"
                    onClick={openLinksModal}
                    className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-cyan-50 hover:text-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-1 cursor-pointer"
                    aria-label="Edit links"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </Tooltip>
              )}
            </div>
            {websiteLinks.length > 0 ? (
              <div className="flex flex-col gap-2">
                {websiteLinks.map((link, index) => (
                  <a
                    key={`${link}-${index}`}
                    href={normalizeLink(link)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                  >
                    {link}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No website links added.</p>
            )}
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1E1B4B]">Reference Site Links</h3>
              {canEditLinks && (
                <Tooltip content="Edit website and reference links">
                  <button
                    type="button"
                    onClick={openLinksModal}
                    className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-cyan-50 hover:text-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-1 cursor-pointer"
                    aria-label="Edit links"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </Tooltip>
              )}
            </div>
            {referenceLinks.length > 0 ? (
              <div className="flex flex-col gap-2">
                {referenceLinks.map((link, index) => (
                  <a
                    key={`${link}-${index}`}
                    href={normalizeLink(link)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                  >
                    {link}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No reference links added.</p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Tabs – Follow-ups, Work history, My Notes, Team Talk */}
        <div className="w-full lg:w-3/5 flex flex-col gap-3 overflow-y-auto pb-24 lg:pb-0 scrollbar-hide">
          <ProjectDetailRightPanel
            projectId={project.id}
            initialFollowUps={initialFollowUps}
            canManageFollowUps={canManageFollowUps}
            userRole={userRole}
            currentUserId={currentUserId}
            teamMembers={project.team_members ?? null}
            staffWorkState={staffWorkState}
            onStaffWorkStatus={handleMyWorkStatus}
          />
        </div>
      </div>

      {/* Mobile action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 p-3 lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)] safe-area-bottom">
        <div className="grid grid-cols-2 gap-3">
          {canEdit && (
            <button
              onClick={handleEdit}
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-gray-600 hover:bg-gray-50 active:bg-gray-100"
            >
              <div className="h-6 w-6 text-[#06B6D4]">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold">Edit</span>
            </button>
          )}

          <button
            onClick={() => setMobileFollowUpsOpen(true)}
            className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-[#06B6D4] text-white shadow-lg active:scale-95 transition-transform"
          >
            <div className="h-6 w-6">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold">Updates</span>
          </button>
        </div>
      </div>

      {/* Mobile updates sheet (Follow-ups, Work history, etc.) */}
      {mobileFollowUpsOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-gray-900/50 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setMobileFollowUpsOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 h-[85vh] bg-[#F8FAFC] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-['Poppins',sans-serif] text-lg font-bold text-[#0C4A6E]">Updates</h3>
              <button
                onClick={() => setMobileFollowUpsOpen(false)}
                className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
              <ProjectDetailRightPanel
                projectId={project.id}
                initialFollowUps={initialFollowUps}
                canManageFollowUps={canManageFollowUps}
                userRole={userRole}
                currentUserId={currentUserId}
                teamMembers={project.team_members ?? null}
                staffWorkState={staffWorkState}
                onStaffWorkStatus={handleMyWorkStatus}
                className="!rounded-none border-0 h-full"
              />
            </div>
          </div>
        </div>
      )}

      {editModalOpen && (
        <ProjectModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          mode="edit"
          initialData={getInitialEditData()}
          onSubmit={async (formData: ProjectFormData) => {
            const result = await updateProject(project.id, formData)
            if (!result.error) {
              showSuccess('Project Updated', 'Changes have been saved.')
              await handleEditSuccess()
            } else {
              showError('Update Failed', result.error)
            }
            return result
          }}
          clients={clients}
          clientsError={clientsError}
          canViewAmount={canViewAmount}
          technologyTools={technologyTools}
          technologyToolsError={technologyToolsError}
          teamMembers={teamMembers}
          teamMembersError={teamMembersError}
        />
      )}

      {/* End Work (Done points) modal – required to fill before ending */}
      {endWorkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-xl">
            <h3 className="text-xl font-bold text-[#1E1B4B] mb-2">End work – Done points</h3>
            <p className="text-sm text-slate-600 mb-4">
              Add a note of what was completed in this session. Required to end work.
            </p>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Done points <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={endWorkNotes}
              onChange={(e) => setEndWorkNotes(e.target.value)}
              placeholder="e.g. Homepage layout, API integration, testing"
              className="mb-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm min-h-[140px] resize-y focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20"
              rows={5}
              required
            />
            <p className="text-xs text-slate-500 mb-4">
              Required. Describe what you completed in this work session before ending.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setEndWorkModalOpen(false); setEndWorkNotes('') }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMyWorkStatus('end', endWorkNotes.trim() || undefined)}
                disabled={myWorkStatusUpdating || !endWorkNotes.trim()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {myWorkStatusUpdating ? 'Saving...' : 'End & save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={handleCloseDelete}
          onConfirm={handleConfirmDelete}
          projectName={project.name}
          isLoading={deleting}
        />
      )}

      {linksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-links-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="edit-links-title" className="text-lg font-bold text-[#1E1B4B] mb-4">Edit links</h3>
            <p className="text-xs text-slate-500 mb-3">One link per line or comma-separated.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Website links</label>
                <textarea
                  value={editWebsiteLinks}
                  onChange={(e) => setEditWebsiteLinks(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[80px] resize-y focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reference site links</label>
                <textarea
                  value={editReferenceLinks}
                  onChange={(e) => setEditReferenceLinks(e.target.value)}
                  placeholder="https://reference.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[80px] resize-y focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => setLinksModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLinks}
                disabled={linksUpdating}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {linksUpdating ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
