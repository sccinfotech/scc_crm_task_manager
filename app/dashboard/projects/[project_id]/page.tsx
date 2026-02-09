import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { getProject, getProjectFollowUps } from '@/lib/projects/actions'
import { getClientsForSelect } from '@/lib/clients/actions'
import { getTechnologyTools } from '@/lib/settings/technology-tools-actions'
import { getStaffForSelect } from '@/lib/users/actions'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ProjectDetailView } from './project-detail-view'
import { Header } from '@/app/components/dashboard/header'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'

interface ProjectDetailPageProps {
  params: Promise<{ project_id: string }>
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const user = await requireAuth()
  const { project_id } = await params
  const canReadModule = await hasPermission(user, MODULE_PERMISSION_IDS.projects, 'read')
  const canRead = user.role === 'admin' || user.role === 'manager' || user.role === 'staff' || canReadModule

  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const [projectResult, followUpsResult, clientsResult, toolsResult, staffResult] = await Promise.all([
    getProject(project_id),
    getProjectFollowUps(project_id),
    getClientsForSelect(),
    getTechnologyTools(),
    getStaffForSelect(),
  ])

  if (projectResult.error || !projectResult.data) {
    notFound()
  }

  const project = projectResult.data
  const initialFollowUps = followUpsResult.data ?? []
  const canWriteModule = await hasPermission(user, MODULE_PERMISSION_IDS.projects, 'write')
  const canManageProject = user.role === 'admin' || user.role === 'manager' || canWriteModule
  const canManageFollowUps = canManageProject || user.role === 'staff'
  const canViewAmount = user.role === 'admin' || user.role === 'manager'

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
      <span className="font-['Poppins',sans-serif] text-lg font-bold text-[#0C4A6E]">Project Details</span>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <Header
        pageTitle="Project Details"
        breadcrumb={breadcrumb}
      />
      <div className="flex-1 overflow-hidden px-3 lg:px-4 pt-2 pb-2">
        <ProjectDetailView
          project={project}
          initialFollowUps={initialFollowUps}
          canManageProject={canManageProject}
          canManageFollowUps={canManageFollowUps}
          canViewAmount={canViewAmount}
          userRole={user.role}
          currentUserId={user.id}
          clients={clientsResult.data}
          clientsError={clientsResult.error}
          technologyTools={toolsResult.data}
          technologyToolsError={toolsResult.error}
          teamMembers={staffResult.data}
          teamMembersError={staffResult.error}
        />
      </div>
    </div>
  )
}

