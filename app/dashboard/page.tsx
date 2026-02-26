import { requireAuth } from '@/lib/auth/utils'
import { getWorkingProjectsForDashboard } from '@/lib/projects/actions'
import { WorkingProjectsSection } from './working-projects-section'

export default async function DashboardPage() {
  const user = await requireAuth()
  const { data: workingProjects, error: workingError } = await getWorkingProjectsForDashboard()
  const isAdmin = user.role === 'admin' || user.role === 'manager'

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[#1E1B4B]">Welcome to the Dashboard</h2>
        <p className="mt-2 text-sm text-gray-600">
          Authentication is working correctly. Your role: <strong>{user.role}</strong>
        </p>
      </div>

      <WorkingProjectsSection
        projects={workingError ? [] : workingProjects ?? []}
        isAdmin={isAdmin}
        currentUserId={user.id}
      />
    </div>
  )
}
