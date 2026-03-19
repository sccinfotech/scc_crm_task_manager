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

function getVisibleProjectDetailTabs(options: {
  showRequirementsAndPayments: boolean
  taskTabOnlyAccess: boolean
}): ProjectDetailTab[] {
  if (options.taskTabOnlyAccess) {
    return ['tasks']
  }

  if (!options.showRequirementsAndPayments) {
    return PROJECT_DETAIL_TABS.filter((tab) => tab !== 'requirements' && tab !== 'payments')
  }

  return PROJECT_DETAIL_TABS
}

function parseProjectDetailTab(value: string | null | undefined): ProjectDetailTab | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return PROJECT_DETAIL_TABS.includes(normalized as ProjectDetailTab)
    ? (normalized as ProjectDetailTab)
    : null
}

function resolveProjectDetailTab(
  tab: ProjectDetailTab | null,
  visibleTabs: ProjectDetailTab[]
): ProjectDetailTab {
  if (!tab) return visibleTabs[0] ?? 'tasks'
  return visibleTabs.includes(tab) ? tab : (visibleTabs[0] ?? 'tasks')
}

interface ProjectDetailPageProps {
  params: Promise<{ project_id: string }>
  searchParams: Promise<{ tab?: string; detailsTab?: string; from?: string; userId?: string; returnTo?: string }>
}

function sanitizeDashboardPath(value: string | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized) return null
  if (!normalized.startsWith('/dashboard')) return null
  if (normalized.startsWith('//')) return null
  return normalized
}

function resolveBreadcrumbLink(query: { from?: string; userId?: string; returnTo?: string }) {
  const safeReturnTo = sanitizeDashboardPath(query.returnTo)
  if (query.from === 'user') {
    if (safeReturnTo) {
      return { href: safeReturnTo, label: 'User Details' }
    }

    const userId = query.userId?.trim()
    if (userId && !userId.includes('/')) {
      return { href: `/dashboard/users/${encodeURIComponent(userId)}`, label: 'User Details' }
    }
  }

  return { href: '/dashboard/projects', label: 'Projects' }
}

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const user = await requireAuth()
  const { project_id } = await params
  const query = await searchParams
  const [canReadProjectsModule, canReadProjectTasksModule, canWriteProjectsModule, canWriteProjectTasksModule] =
    await Promise.all([
      hasPermission(user, MODULE_PERMISSION_IDS.projects, 'read'),
      hasPermission(user, MODULE_PERMISSION_IDS.projectTasks, 'read'),
      hasPermission(user, MODULE_PERMISSION_IDS.projects, 'write'),
      hasPermission(user, MODULE_PERMISSION_IDS.projectTasks, 'write'),
    ])

  const canRead =
    user.role === 'admin' ||
    user.role === 'manager' ||
    user.role === 'staff' ||
    canReadProjectsModule ||
    canReadProjectTasksModule

  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const showRequirementsAndPayments = user.role !== 'staff' && user.role !== 'client'
  const taskTabOnlyAccess = !canReadProjectsModule && canReadProjectTasksModule
  const visibleTabs = getVisibleProjectDetailTabs({
    showRequirementsAndPayments,
    taskTabOnlyAccess,
  })
  const initialResolvedTab = resolveProjectDetailTab(
    parseProjectDetailTab(query.tab),
    visibleTabs
  )

  // Always load time events so the header work timer shows accurate elapsed time on first load (no need to open Details tab).
  const projectResult = await getProject(project_id, {
    includeTimeEvents: true,
  })

  if (projectResult.error || !projectResult.data) {
    notFound()
  }

  const project = projectResult.data
  // Load task assignees only when the initial tab needs Tasks.
  const canManageProject = user.role === 'admin' || user.role === 'manager' || canWriteProjectsModule
  const canManageTasks =
    user.role === 'admin' ||
    user.role === 'manager' ||
    canWriteProjectsModule ||
    canWriteProjectTasksModule
  const shouldFetchTaskAssignees = initialResolvedTab === 'tasks' && canManageTasks
  const staffResult = shouldFetchTaskAssignees
    ? await getStaffForSelect()
    : { data: [], error: null as string | null }

  // Follow-ups (and Work history, etc.) load only when user opens that tab
  const canManageFollowUps = canManageProject || user.role === 'staff'
  const canViewAmount = user.role === 'admin' || user.role === 'manager'
  const breadcrumbLink = resolveBreadcrumbLink(query)

  const projectName = project.name ?? 'Project'
  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href={breadcrumbLink.href}
        className="font-medium text-[#06B6D4] hover:text-[#0891b2] hover:underline transition-colors"
      >
        {breadcrumbLink.label}
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
          canManageTasks={canManageTasks}
          canManageFollowUps={canManageFollowUps}
          canViewAmount={canViewAmount}
          userRole={user.role}
          taskTabOnlyAccess={taskTabOnlyAccess}
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
