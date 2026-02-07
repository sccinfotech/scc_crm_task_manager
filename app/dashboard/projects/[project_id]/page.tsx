import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { getProject, getProjectFollowUps } from '@/lib/projects/actions'
import { getClientsForSelect } from '@/lib/clients/actions'
import { getTechnologyTools } from '@/lib/settings/technology-tools-actions'
import { getStaffForSelect } from '@/lib/users/actions'
import { notFound, redirect } from 'next/navigation'
import { ProjectDetailView } from './project-detail-view'
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

  return (
    <div className="flex h-full flex-col p-4 lg:p-6">
      <div className="flex-1 overflow-hidden">
        <ProjectDetailView
          project={project}
          initialFollowUps={initialFollowUps}
          canManageProject={canManageProject}
          canManageFollowUps={canManageFollowUps}
          canViewAmount={canViewAmount}
          userRole={user.role}
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
