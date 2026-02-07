import Link from 'next/link'
import { EmptyState } from '@/app/components/empty-state'
import { Tooltip } from '@/app/components/ui/tooltip'
import type { ProjectStatus } from '@/lib/projects/actions'

type Project = {
  id: string
  name: string
  logo_url: string | null
  client_name: string | null
  client_company_name: string | null
  status: ProjectStatus
  start_date: string
  project_amount: number | null
  website_links: string | null
  created_at: string
}

type SortField =
  | 'name'
  | 'status'
  | 'start_date'
  | 'created_at'
  | 'project_amount'
  | null

type SortDirection = 'asc' | 'desc' | null

interface ProjectsTableProps {
  projects: Project[]
  canWrite: boolean
  canViewAmount: boolean
  onView: (projectId: string) => void
  onEdit: (projectId: string) => void
  onDelete: (projectId: string, projectName: string) => void
  sortField?: SortField
  sortDirection?: SortDirection
  onSort?: (field: SortField) => void
  isFiltered?: boolean
}

function StatusPill({ status }: { status: ProjectStatus }) {
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
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
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

function parseWebsiteLinks(value: string | null) {
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

export function ProjectsTable({
  projects,
  canWrite,
  canViewAmount,
  onView,
  onEdit,
  onDelete,
  sortField = null,
  sortDirection = null,
  onSort,
  isFiltered = false,
}: ProjectsTableProps) {
  const handleSort = (field: SortField) => {
    if (!onSort) return
    if (sortField === field) {
      onSort(sortDirection === 'asc' ? null : field)
    } else {
      onSort(field)
    }
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
              className="group w-[32%] sm:w-[22%] px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center">
                Project
                <SortIcon direction={sortField === 'name' ? sortDirection : null} />
              </div>
            </th>
            <th className="hidden sm:table-cell sm:w-[18%] px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Client
            </th>
            <th
              className="group w-[16%] sm:w-[12%] px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center">
                Status
                <SortIcon direction={sortField === 'status' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="group hidden md:table-cell md:w-[13%] px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-all duration-200"
              onClick={() => handleSort('start_date')}
            >
              <div className="flex items-center">
                Start
                <SortIcon direction={sortField === 'start_date' ? sortDirection : null} />
              </div>
            </th>
            {canViewAmount && (
              <th
                className="group hidden xl:table-cell xl:w-[12%] px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-all duration-200"
                onClick={() => handleSort('project_amount')}
              >
                <div className="flex items-center">
                  Amount
                  <SortIcon direction={sortField === 'project_amount' ? sortDirection : null} />
                </div>
              </th>
            )}
            <th
              className="group hidden xl:table-cell xl:w-[12%] px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-all duration-200"
              onClick={() => handleSort('created_at')}
            >
              <div className="flex items-center">
                Created
                <SortIcon direction={sortField === 'created_at' ? sortDirection : null} />
              </div>
            </th>
            <th className="w-[14%] sm:w-[12%] px-4 sm:px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 transition-all duration-200">
              {canWrite ? 'Actions' : 'View'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {projects.map((project) => {
            const canEdit = canWrite
            const canDelete = canWrite
            const clientLabel = project.client_name || project.client_company_name || '--'
            const websiteLinks = parseWebsiteLinks(project.website_links)

            return (
              <tr
                key={project.id}
                className="group transition-all duration-200 hover:bg-slate-50 cursor-pointer relative"
              >
                <td className="px-4 sm:px-6 py-3">
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    prefetch
                    className="flex items-center gap-2 sm:gap-3 no-underline text-inherit"
                  >
                    {project.logo_url ? (
                      <img
                        src={project.logo_url}
                        alt={project.name}
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover shadow-sm ring-2 ring-white"
                      />
                    ) : (
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs sm:text-sm font-bold text-white shadow-sm flex-shrink-0 ring-2 ring-white">
                        {getInitials(project.name)}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm sm:text-base font-semibold text-gray-900 leading-tight" title={project.name}>
                        {project.name}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="hidden px-6 py-3 sm:table-cell">
                  <div className="truncate text-sm text-gray-500" title={clientLabel}>
                    {clientLabel}
                  </div>
                </td>
                <td className="px-4 sm:px-6 py-3">
                  <Link href={`/dashboard/projects/${project.id}`} prefetch className="block no-underline text-inherit">
                    <StatusPill status={project.status} />
                  </Link>
                </td>
                <td className="hidden px-6 py-3 text-sm text-gray-500 md:table-cell">
                  <Link href={`/dashboard/projects/${project.id}`} prefetch className="block no-underline text-inherit">
                    {formatDate(project.start_date)}
                  </Link>
                </td>
                {canViewAmount && (
                  <td className="hidden px-6 py-3 text-sm text-gray-500 xl:table-cell">
                    <Link href={`/dashboard/projects/${project.id}`} prefetch className="block no-underline text-inherit">
                      <span className="font-semibold text-gray-900">{formatCurrency(project.project_amount)}</span>
                    </Link>
                  </td>
                )}
                <td className="hidden px-6 py-3 text-sm text-gray-500 xl:table-cell">
                  <Link href={`/dashboard/projects/${project.id}`} prefetch className="block no-underline text-inherit">
                    {formatDate(project.created_at)}
                  </Link>
                </td>
                <td className="px-4 sm:px-6 py-3 text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    {websiteLinks.length > 0 &&
                      websiteLinks.map((link, index) => (
                        <Tooltip key={`${link}-${index}`} content={link} position="left">
                          <a
                            href={normalizeLink(link)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                          >
                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0L6 12.343a4 4 0 105.657 5.657l1.414-1.414" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0L18 11.657a4 4 0 10-5.657-5.657l-1.414 1.414" />
                            </svg>
                          </a>
                        </Tooltip>
                      ))}
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
    </div>
  )
}
