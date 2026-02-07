'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import {
  Project,
  ProjectStatus,
  ProjectFollowUp,
  ProjectStaffStatus,
  ProjectPriority,
  getProject,
  updateProject,
  updateProjectStatus,
  updateProjectStaffStatus,
  deleteProject,
  ProjectFormData,
} from '@/lib/projects/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'
import type { StaffSelectOption } from '@/lib/users/actions'
import { ProjectFollowUps } from '../project-followups'
import { ProjectModal } from '../project-modal'
import { DeleteConfirmModal } from '../delete-confirm-modal'

interface ProjectDetailViewProps {
  project: Project
  initialFollowUps?: ProjectFollowUp[]
  canManageProject: boolean
  canManageFollowUps: boolean
  canViewAmount: boolean
  userRole: string
  clients: ClientSelectOption[]
  clientsError: string | null
  technologyTools: TechnologyTool[]
  technologyToolsError: string | null
  teamMembers: StaffSelectOption[]
  teamMembersError: string | null
}

function StatusPill({ status }: { status: ProjectStatus }) {
  const statusStyles = {
    pending: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200',
    in_progress: 'bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200',
    hold: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
    completed: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200',
  }

  const statusLabels = {
    pending: 'Pending',
    in_progress: 'In Progress',
    hold: 'Hold',
    completed: 'Completed',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border transition-all duration-200 ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  )
}

function PriorityPill({ priority }: { priority: ProjectPriority }) {
  const priorityStyles = {
    urgent: 'bg-rose-100 text-rose-800 border-rose-200',
    high: 'bg-amber-100 text-amber-800 border-amber-200',
    medium: 'bg-slate-100 text-slate-700 border-slate-200',
    low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  }

  const priorityLabels = {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${priorityStyles[priority]}`}>
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

function formatStaffStatus(status: ProjectStaffStatus | null) {
  if (!status) return '--'
  if (status === 'start') return 'Start'
  if (status === 'hold') return 'Hold'
  return 'End'
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

const CLIENT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'hold', label: 'Hold' },
  { value: 'completed', label: 'Completed' },
]

const STAFF_STATUS_OPTIONS: { value: ProjectStaffStatus; label: string }[] = [
  { value: 'start', label: 'Start' },
  { value: 'hold', label: 'Hold' },
  { value: 'end', label: 'End' },
]

export function ProjectDetailView({
  project: initialProject,
  initialFollowUps = [],
  canManageProject,
  canManageFollowUps,
  canViewAmount,
  userRole,
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
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mobileFollowUpsOpen, setMobileFollowUpsOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [staffStatusUpdating, setStaffStatusUpdating] = useState(false)

  const canEdit = canManageProject
  const canDelete = canManageProject
  const canEditClientStatus = userRole === 'admin' || userRole === 'manager'
  const canEditStaffStatus = userRole === 'admin' || userRole === 'manager' || userRole === 'staff'

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

  const handleStaffStatusChange = async (nextStatus: ProjectStaffStatus) => {
    if (nextStatus === project.staff_status || staffStatusUpdating) return
    setStaffStatusUpdating(true)
    const result = await updateProjectStaffStatus(project.id, nextStatus)
    setStaffStatusUpdating(false)

    if (!result.error && result.data) {
      setProject(result.data)
      showSuccess('Staff Status Updated', 'Staff status has been updated.')
      router.refresh()
    } else {
      showError('Update Failed', result.error || 'Failed to update staff status')
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

  return (
    <>
      <div className="flex h-full flex-col lg:flex-row gap-4">
        {/* LEFT COLUMN: Project Details */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4 overflow-y-auto pb-24 lg:pb-0 scrollbar-hide">
          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 relative">
            <div className="relative bg-white border-b border-gray-100 p-6 rounded-t-2xl">
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

                  <div className="flex-1">
                    <h1 className="text-2xl font-extrabold text-[#1E1B4B] mb-1">{project.name}</h1>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={project.status} />
                      <PriorityPill priority={project.priority} />
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        Staff: {formatStaffStatus(project.staff_status)}
                      </span>
                      {project.client?.id ? (
                        <Link
                          href={`/dashboard/clients/${project.client.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-100 hover:bg-cyan-100 transition-colors"
                        >
                          View Client
                        </Link>
                      ) : null}
                    </div>
                    {(canEditClientStatus || canEditStaffStatus) && (
                      <div className="mt-3 flex flex-wrap gap-4">
                        {canEditClientStatus && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              Client Status
                            </p>
                            <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1">
                              {CLIENT_STATUS_OPTIONS.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => handleClientStatusChange(option.value)}
                                  disabled={statusUpdating}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                                    project.status === option.value
                                      ? 'bg-white text-cyan-700 shadow-sm'
                                      : 'text-slate-500 hover:text-slate-700'
                                  } ${statusUpdating ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {canEditStaffStatus && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              Staff Status
                            </p>
                            <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1">
                              {STAFF_STATUS_OPTIONS.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => handleStaffStatusChange(option.value)}
                                  disabled={staffStatusUpdating}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                                    project.staff_status === option.value
                                      ? 'bg-white text-cyan-700 shadow-sm'
                                      : 'text-slate-500 hover:text-slate-700'
                                  } ${staffStatusUpdating ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canEdit && (
                    <Tooltip content="Edit project">
                      <button
                        onClick={handleEdit}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
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
                        onClick={handleDelete}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
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

            <div className="p-6 bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200">
                  <div className="h-12 w-12 rounded-xl bg-cyan-50 flex items-center justify-center">
                    <svg className="h-6 w-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</p>
                    <p className="text-sm font-semibold text-slate-700">{clientLabel}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200">
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

                <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200">
                  <div className="h-12 w-12 rounded-xl bg-cyan-50 flex items-center justify-center">
                    <svg className="h-6 w-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Developer Deadline</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {project.developer_deadline_date ? formatDate(project.developer_deadline_date) : '--'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200">
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

                <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200">
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

          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
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

          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1E1B4B]">Team Members</h3>
            </div>
            {project.team_members && project.team_members.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {project.team_members.map((member) => (
                  <span
                    key={member.id}
                    className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                  >
                    {member.full_name || member.email || 'Staff Member'}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No team members assigned.
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
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

          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1E1B4B]">Website Links</h3>
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

          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1E1B4B]">Reference Site Links</h3>
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

        {/* RIGHT COLUMN: Follow-Ups */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4 overflow-y-auto pb-24 lg:pb-0 scrollbar-hide">
          <ProjectFollowUps
            projectId={project.id}
            initialFollowUps={initialFollowUps}
            canWrite={canManageFollowUps}
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
            <span className="text-[10px] font-bold">Follow-Ups</span>
          </button>
        </div>
      </div>

      {/* Mobile follow-ups sheet */}
      {mobileFollowUpsOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-gray-900/50 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setMobileFollowUpsOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 h-[85vh] bg-[#F8FAFC] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-['Poppins',sans-serif] text-lg font-bold text-[#0C4A6E]">Follow-Ups</h3>
              <button
                onClick={() => setMobileFollowUpsOpen(false)}
                className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <ProjectFollowUps
                projectId={project.id}
                initialFollowUps={initialFollowUps}
                canWrite={canManageFollowUps}
                hideHeader={true}
                className="!bg-transparent !shadow-none !border-none !p-0 !rounded-none h-full"
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

      {deleteModalOpen && (
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={handleCloseDelete}
          onConfirm={handleConfirmDelete}
          projectName={project.name}
          isLoading={deleting}
        />
      )}
    </>
  )
}
