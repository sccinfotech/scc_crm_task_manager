import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { getProject } from '@/lib/projects/actions'
import { getStaffForSelect } from '@/lib/users/actions'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ProjectDetailView } from './project-detail-view'
import { Header } from '@/app/components/dashboard/header'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'

type ProjectDetailTab = 'details' | 'payments' | 'requirements' | 'tasks'

const PROJECT_DETAIL_TABS: ProjectDetailTab[] = ['tasks', 'requirements', 'payments', 'details']

function parseProjectDetailTab(value: string | null | undefined): ProjectDetailTab | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return PROJECT_DETAIL_TABS.includes(normalized as ProjectDetailTab)
    ? (normalized as ProjectDetailTab)
    : null
}

function resolveProjectDetailTab(
  tab: ProjectDetailTab | null,
  showRequirementsAndPayments: boolean
): ProjectDetailTab {
  if (!tab) return 'tasks'
  if (!showRequirementsAndPayments && (tab === 'requirements' || tab === 'payments')) {
    return 'tasks'
  }
  return tab
}

interface ProjectDetailPageProps {
  params: Promise<{ project_id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const user = await requireAuth()
  const { project_id } = await params
  const query = await searchParams
  const canReadModule = await hasPermission(user, MODULE_PERMISSION_IDS.projects, 'read')
  const canRead = user.role === 'admin' || user.role === 'manager' || user.role === 'staff' || canReadModule

  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const projectResult = await getProject(project_id)

  if (projectResult.error || !projectResult.data) {
    notFound()
  }

  const project = projectResult.data
  const showRequirementsAndPayments = user.role !== 'staff' && user.role !== 'client'
  const initialResolvedTab = resolveProjectDetailTab(
    parseProjectDetailTab(query.tab),
    showRequirementsAndPayments
  )
  // Load task assignees only when the initial tab needs Tasks.
  const shouldFetchTaskAssignees = initialResolvedTab === 'tasks'
  const staffResult = shouldFetchTaskAssignees
    ? await getStaffForSelect()
    : { data: [], error: null as string | null }

  // Follow-ups (and Work history, etc.) load only when user opens that tab
  const canWriteModule = await hasPermission(user, MODULE_PERMISSION_IDS.projects, 'write')
  const canManageProject = user.role === 'admin' || user.role === 'manager' || canWriteModule
  const canManageFollowUps = canManageProject || user.role === 'staff'
  const canViewAmount = user.role === 'admin' || user.role === 'manager'

  const projectName = project.name ?? 'Project'
  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href="/dashboard/projects"
        className="font-medium text-[#06B6D4] hover:text-[#0891b2] hover:underline transition-colors"
      >
        Projects
      </Link>
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      <span className="font-['Poppins',sans-serif] text-lg font-bold text-[#0C4A6E] truncate max-w-[200px] sm:max-w-[320px]" title={projectName}>{projectName}</span>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <Header
        pageTitle={projectName}
        breadcrumb={breadcrumb}
        userId={user.id}
      />
      <div className="flex-1 overflow-hidden px-2.5 pt-2 pb-2 sm:px-3 lg:px-4">
        <ProjectDetailView
          project={project}
          initialFollowUps={[]}
          initialTab={initialResolvedTab}
          canManageProject={canManageProject}
          canManageFollowUps={canManageFollowUps}
          canViewAmount={canViewAmount}
          userRole={user.role}
          currentUserId={user.id}
          clients={[]}
          clientsError={null}
          technologyTools={[]}
          technologyToolsError={null}
          teamMembers={staffResult.data}
          teamMembersError={staffResult.error}
          initialClientsLoaded={false}
          initialTechnologyToolsLoaded={false}
          initialTeamMembersLoaded={shouldFetchTaskAssignees}
        />
      </div>
    </div>
  )
}
