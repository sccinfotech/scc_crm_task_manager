import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { ProjectsClient } from './projects-client'
import { getProjectsPage, type ProjectStatus, type ProjectSortField } from '@/lib/projects/actions'
import { getClientsForSelect } from '@/lib/clients/actions'
import { getTechnologyTools } from '@/lib/settings/technology-tools-actions'
import { getStaffForSelect } from '@/lib/users/actions'

const PAGE_SIZE = 20

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    sort?: string
    sortDir?: 'asc' | 'desc'
    page?: string
  }>
}) {
  const user = await requireAuth()
  const canReadModule = await hasPermission(user, MODULE_PERMISSION_IDS.projects, 'read')
  const canRead = user.role === 'admin' || user.role === 'manager' || user.role === 'staff' || canReadModule

  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const canWriteModule = await hasPermission(user, MODULE_PERMISSION_IDS.projects, 'write')
  const canWrite = user.role === 'admin' || user.role === 'manager' || canWriteModule
  const canViewAmount = user.role === 'admin' || user.role === 'manager'

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const [projectsResult, clientsResult, toolsResult, staffResult] = await Promise.all([
    getProjectsPage({
      search: params.search,
      status: (params.status as ProjectStatus | undefined) ?? 'all',
      sortField: (params.sort as ProjectSortField | undefined) ?? 'created_at',
      sortDirection: params.sortDir ?? 'desc',
      page,
      pageSize: PAGE_SIZE,
    }),
    getClientsForSelect(),
    getTechnologyTools(),
    getStaffForSelect(),
  ])

  if (projectsResult.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Failed to load projects: {projectsResult.error}</p>
      </div>
    )
  }

  return (
    <ProjectsClient
      projects={projectsResult.data}
      totalCount={projectsResult.totalCount}
      page={page}
      pageSize={PAGE_SIZE}
      initialSearch={params.search ?? ''}
      initialStatus={(params.status as ProjectStatus | 'all') ?? 'all'}
      initialSortField={(params.sort as ProjectSortField) ?? 'created_at'}
      initialSortDirection={params.sortDir ?? 'desc'}
      canWrite={canWrite}
      canViewAmount={canViewAmount}
      clients={clientsResult.data}
      clientsError={clientsResult.error}
      technologyTools={toolsResult.data}
      technologyToolsError={toolsResult.error}
      teamMembers={staffResult.data}
      teamMembersError={staffResult.error}
    />
  )
}
