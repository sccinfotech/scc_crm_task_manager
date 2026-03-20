import Image from 'next/image'
import Link from 'next/link'
import { memo, useState, type ReactNode } from 'react'
import { EmptyState } from '@/app/components/empty-state'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import { updateMyProjectWorkStatus } from '@/lib/projects/actions'
import type { ProjectStatus, ProjectTeamMemberWorkStatus } from '@/lib/projects/actions'
import { EndWorkModal } from './end-work-modal'

type Project = {
  id: string
  name: string
  logo_url: string | null
  client_name: string | null
  client_company_name: string | null
  status: ProjectStatus
  client_deadline_date: string | null
  project_amount: number | null
  website_links: string | null
  created_at: string
  follow_up_date: string | null
  my_work_status?: ProjectTeamMemberWorkStatus | null
  my_work_started_at?: string | null
}

type SortField =
  | 'name'
  | 'status'
  | 'client_deadline_date'
  | 'follow_up_date'
  | 'created_at'
  | 'project_amount' // kept for URL/API compatibility; column not shown
  | null

type SortDirection = 'asc' | 'desc' | null

interface ProjectsTableProps {
  projects: Project[]
  canWrite: boolean
  showClientColumn?: boolean
  /** When true, show Work column with Start / Hold / End for staff. */
  showWorkActions?: boolean
  buildProjectHref?: (projectId: string) => string
  showWorkingStatusColumn?: boolean
  getWorkingStatusLabel?: (project: Project) => string | undefined
  onView: (projectId: string) => void
  onEdit: (projectId: string) => void
  onDelete: (projectId: string, projectName: string) => void
  onWorkUpdated?: () => void
  sortField?: SortField
  sortDirection?: SortDirection
  onSort?: (field: SortField) => void
  isFiltered?: boolean
}

const StatusPill = memo(function StatusPill({ status }: { status: ProjectStatus }) {
  const styles = {
    pending: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500', ring: 'ring-slate-500/20' },
    in_progress: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-600', ring: 'ring-cyan-600/20' },
    hold: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-600', ring: 'ring-amber-600/20' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-600', ring: 'ring-emerald-600/20' },
  }

  const labels = {
    pending: 'Pending',
    in_progress: 'In Progress',
    hold: 'Hold',
    completed: 'Completed',
  }

  const style = styles[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${style.bg} ${style.text} ring-1 ring-inset ${style.ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`}></span>
      {labels[status]}
    </span>
  )
})

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatFollowUpDate(dateString: string | null) {
  if (!dateString) return null
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getFollowUpDateColor(dateString: string | null): string {
  if (!dateString) return 'text-gray-500'
  const followUpDate = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const followUpDateOnly = new Date(followUpDate)
  followUpDateOnly.setHours(0, 0, 0, 0)
  const diffTime = followUpDateOnly.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'text-red-600 font-semibold'
  if (diffDays <= 7) return 'text-amber-600 font-semibold'
  return 'text-gray-700'
}

function formatClientLabel(clientName: string | null | undefined, companyName: string | null | undefined) {
  const name = clientName?.trim() || null
  const company = companyName?.trim() || null

  if (name && company) return `${name} (${company})`
  if (name) return name
  if (company) return company
  return '--'
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (!direction) {
    return (
      <svg className="ml-1 h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    )
  }
  return direction === 'asc' ? (
    <svg className="ml-1 h-3.5 w-3.5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="ml-1 h-3.5 w-3.5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function getInitials(name: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getWorkingStatusBadgeClasses(label: string): string {
  const normalized = label.trim().toLowerCase()
  if (normalized === 'working on' || normalized === 'working') {
    return 'bg-cyan-50 text-cyan-700 ring-cyan-600/20'
  }
  if (normalized === 'hold') {
    return 'bg-amber-50 text-amber-700 ring-amber-600/20'
  }
  if (normalized === 'not started') {
    return 'bg-slate-100 text-slate-700 ring-slate-500/20'
  }
  if (normalized === 'ended') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
  }
  return 'bg-slate-100 text-slate-700 ring-slate-500/20'
}

function WorkActionIcon({ action }: { action: 'start' | 'hold' | 'resume' | 'end' }) {
  if (action === 'hold') {
    return (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  if (action === 'end') {
    return (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 9.5h5v5h-5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function WorkActionButton({
  label,
  tone,
  disabled,
  isLoading,
  onClick,
  icon,
}: {
  label: string
  tone: 'emerald' | 'amber' | 'cyan' | 'slate'
  disabled: boolean
  isLoading: boolean
  onClick: () => void
  icon: ReactNode
}) {
  const toneClasses: Record<'emerald' | 'amber' | 'cyan' | 'slate', string> = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
    cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200',
    slate: 'bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300',
  }

  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${toneClasses[tone]}`}
      >
        {isLoading ? (
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path className="opacity-90" d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          icon
        )}
      </button>
    </Tooltip>
  )
}

export const ProjectsTable = memo(function ProjectsTable({
  projects,
  canWrite,
  showClientColumn = true,
  showWorkActions = false,
  buildProjectHref,
  showWorkingStatusColumn = false,
  getWorkingStatusLabel,
  onView,
  onEdit,
  onDelete,
  onWorkUpdated,
  sortField = null,
  sortDirection = null,
  onSort,
  isFiltered = false,
}: ProjectsTableProps) {
  const [endWorkProject, setEndWorkProject] = useState<{ id: string; name: string } | null>(null)
  const [workActionProjectId, setWorkActionProjectId] = useState<string | null>(null)
  const { success: showToastSuccess, error: showToastError, info: showToastInfo } = useToast()

  const handleSort = (field: SortField) => {
    if (!onSort) return
    if (sortField === field) {
      onSort(sortDirection === 'asc' ? null : field)
    } else {
      onSort(field)
    }
  }

  const handleWorkAction = async (projectId: string, eventType: 'start' | 'hold' | 'resume' | 'end', note?: string) => {
    if (workActionProjectId) return
    setWorkActionProjectId(projectId)
    const result = await updateMyProjectWorkStatus(projectId, eventType, note ?? undefined)
    setWorkActionProjectId(null)
    setEndWorkProject(null)
    if (result.autoEndedSessions.length > 0) {
      showToastInfo(
        'Session auto-ended',
        `Your running Work session was automatically ended at ${result.cutoffLabel} (${result.cutoffTimezone}).`
      )
    }
    if (!result.error) {
      const messages: Record<string, string> = {
        start: 'Work started.',
        hold: 'Work paused.',
        resume: 'Work resumed.',
        end: 'Work ended and notes saved.',
      }
      showToastSuccess('Work updated', messages[eventType] ?? 'Done.')
      onWorkUpdated?.()
    } else {
      showToastError('Work action failed', result.error)
    }
    return result
  }

  const handleEndWorkSubmit = async (projectId: string, _projectName: string, doneNotes: string) => {
    await handleWorkAction(projectId, 'end', doneNotes)
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full w-full min-h-[500px] items-center justify-center bg-white">
        <div className="w-full max-w-lg">
          <EmptyState
            variant={isFiltered ? 'search' : 'projects'}
            title={isFiltered ? 'No projects found' : 'No projects yet'}
            description={
              isFiltered
                ? 'Try adjusting your filters.'
                : 'Create your first project to get started.'
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-white">
      <table className="w-full table-fixed divide-y divide-gray-100">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="bg-gray-50/50">
            <th
              className="group w-[36%] min-w-[140px] sm:w-[28%] md:w-[26%] px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center">
                Project
                <SortIcon direction={sortField === 'name' ? sortDirection : null} />
              </div>
            </th>
            {showClientColumn && (
              <th className="hidden sm:table-cell sm:w-[16%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Client
              </th>
            )}
            <th
              className="group w-[14%] sm:w-[10%] px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center">
                Status
                <SortIcon direction={sortField === 'status' ? sortDirection : null} />
              </div>
            </th>
            {showWorkingStatusColumn && (
              <th className="hidden md:table-cell md:w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Working Status
              </th>
            )}
            <th
              className="group hidden md:table-cell md:w-[15%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-all duration-200"
              onClick={() => handleSort('client_deadline_date')}
            >
              <div className="flex items-center">
                Client Deadline
                <SortIcon direction={sortField === 'client_deadline_date' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="group hidden lg:table-cell lg:w-[10%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-all duration-200"
              onClick={() => handleSort('follow_up_date')}
            >
              <div className="flex items-center">
                Follow-up
                <SortIcon direction={sortField === 'follow_up_date' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="group hidden xl:table-cell xl:w-[10%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-all duration-200"
              onClick={() => handleSort('created_at')}
            >
              <div className="flex items-center">
                Created
                <SortIcon direction={sortField === 'created_at' ? sortDirection : null} />
              </div>
            </th>
            {showWorkActions && (
              <th className="w-[120px] sm:w-[100px] px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Work
              </th>
            )}
            <th className="w-[12%] sm:w-[10%] px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 transition-all duration-200">
              {canWrite ? 'Actions' : 'View'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {projects.map((project) => {
            const canEdit = canWrite
            const canDelete = canWrite
            const clientLabel = formatClientLabel(project.client_name, project.client_company_name)
            const projectHref = buildProjectHref
              ? buildProjectHref(project.id)
              : `/dashboard/projects/${project.id}?tab=tasks`

            return (
              <tr
                key={project.id}
                className="group transition-all duration-200 hover:bg-slate-50 cursor-pointer relative"
              >
                <td className="px-3 sm:px-4 py-3">
                  <Link
                    href={projectHref}
                    prefetch
                    className="flex items-center gap-2 sm:gap-3 no-underline text-inherit"
                  >
                    {project.logo_url ? (
                      <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200/80 shadow-sm sm:h-9 sm:w-9">
                        <Image
                          src={project.logo_url}
                          alt={project.name}
                          fill
                          className="object-contain p-0.5"
                          sizes="36px"
                        />
                      </span>
                    ) : (
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs sm:text-sm font-bold text-white shadow-sm flex-shrink-0 ring-2 ring-white">
                        {getInitials(project.name)}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="line-clamp-2 break-words text-sm sm:text-base font-semibold text-gray-900 leading-snug" title={project.name}>
                        {project.name}
                      </span>
                    </div>
                  </Link>
                </td>
                {showClientColumn && (
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="truncate text-sm text-gray-500" title={clientLabel}>
                      {clientLabel}
                    </div>
                  </td>
                )}
                <td className="px-4 sm:px-4 py-3">
                  <Link href={projectHref} prefetch className="block no-underline text-inherit">
                    <StatusPill status={project.status} />
                  </Link>
                </td>
                {showWorkingStatusColumn && (
                  <td className="hidden md:table-cell px-4 py-3">
                    <Link href={projectHref} prefetch className="block no-underline text-inherit">
                      {(() => {
                        const statusLabel = getWorkingStatusLabel?.(project)
                        if (!statusLabel) {
                          return <span className="text-sm font-medium text-slate-400">--</span>
                        }
                        return (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${getWorkingStatusBadgeClasses(statusLabel)}`}
                          >
                            {statusLabel}
                          </span>
                        )
                      })()}
                    </Link>
                  </td>
                )}
                <td className="hidden px-4 py-3 text-sm text-gray-500 md:table-cell">
                  <Link href={projectHref} prefetch className="block no-underline text-inherit">
                    {project.client_deadline_date ? formatDate(project.client_deadline_date) : '--'}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-sm text-gray-500 lg:table-cell">
                  <Link href={projectHref} prefetch className="block no-underline text-inherit">
                    {project.follow_up_date ? (
                      <span className={getFollowUpDateColor(project.follow_up_date)}>
                        {formatFollowUpDate(project.follow_up_date)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-sm text-gray-500 xl:table-cell">
                  <Link href={projectHref} prefetch className="block no-underline text-inherit">
                    {formatDate(project.created_at)}
                  </Link>
                </td>
                {showWorkActions && (
                  <td className="px-3 sm:px-4 py-3 text-sm">
                    {project.my_work_status != null ? (
                      <div className="flex items-center gap-1">
                        {project.my_work_status === 'not_started' && (
                          <WorkActionButton
                            label="Start"
                            tone="emerald"
                            disabled={workActionProjectId === project.id}
                            isLoading={workActionProjectId === project.id}
                            onClick={() => handleWorkAction(project.id, 'start')}
                            icon={<WorkActionIcon action="start" />}
                          />
                        )}
                        {project.my_work_status === 'start' && (
                          <>
                            <WorkActionButton
                              label="Hold"
                              tone="amber"
                              disabled={workActionProjectId === project.id}
                              isLoading={workActionProjectId === project.id}
                              onClick={() => handleWorkAction(project.id, 'hold')}
                              icon={<WorkActionIcon action="hold" />}
                            />
                            <WorkActionButton
                              label="End session"
                              tone="slate"
                              disabled={workActionProjectId === project.id}
                              isLoading={false}
                              onClick={() => setEndWorkProject({ id: project.id, name: project.name })}
                              icon={<WorkActionIcon action="end" />}
                            />
                          </>
                        )}
                        {project.my_work_status === 'hold' && (
                          <>
                            <WorkActionButton
                              label="Resume"
                              tone="cyan"
                              disabled={workActionProjectId === project.id}
                              isLoading={workActionProjectId === project.id}
                              onClick={() => handleWorkAction(project.id, 'resume')}
                              icon={<WorkActionIcon action="resume" />}
                            />
                            <WorkActionButton
                              label="End session"
                              tone="slate"
                              disabled={workActionProjectId === project.id}
                              isLoading={false}
                              onClick={() => setEndWorkProject({ id: project.id, name: project.name })}
                              icon={<WorkActionIcon action="end" />}
                            />
                          </>
                        )}
                        {project.my_work_status === 'end' && (
                          <WorkActionButton
                            label="Start again"
                            tone="emerald"
                            disabled={workActionProjectId === project.id}
                            isLoading={workActionProjectId === project.id}
                            onClick={() => handleWorkAction(project.id, 'start')}
                            icon={<WorkActionIcon action="start" />}
                          />
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                )}
                <td className="px-3 sm:px-4 py-3 text-right text-sm">
                  <div className="flex items-center justify-end gap-1">
                    {canEdit && (
                      <Tooltip content="Edit project" position="left">
                        <button
                          onClick={() => onEdit(project.id)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip content="Remove project" position="left">
                        <button
                          onClick={() => onDelete(project.id, project.name)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <EndWorkModal
        isOpen={endWorkProject != null}
        onClose={() => setEndWorkProject(null)}
        projectName={endWorkProject?.name ?? ''}
        onSubmit={(doneNotes) =>
          endWorkProject
            ? handleEndWorkSubmit(endWorkProject.id, endWorkProject.name, doneNotes)
            : Promise.resolve()
        }
        isLoading={endWorkProject != null && workActionProjectId === endWorkProject.id}
      />
    </div>
  )
})
