import { requireAuth } from '@/lib/auth/utils'
import { getWorkingProjectsForDashboard } from '@/lib/projects/actions'
import { getNotifications } from '@/lib/notifications/actions'
import { SidebarToggleButton } from '@/app/components/dashboard/sidebar-context'
import { WorkingProjectsSection } from './working-projects-section'
import { NotificationsSection } from './notifications-section'

export default async function DashboardPage() {
  const user = await requireAuth()
  const [workingResult, notificationsResult] = await Promise.all([
    getWorkingProjectsForDashboard(),
    getNotifications(30),
  ])
  const workingProjects = workingResult.error ? [] : workingResult.data ?? []
  const notifications = notificationsResult.error ? [] : notificationsResult.data ?? []
  const isAdmin = user.role === 'admin' || user.role === 'manager'

  return (
    <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <SidebarToggleButton />
          <h1 className="text-xl font-semibold text-[#1E1B4B] sm:text-2xl">Dashboard</h1>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-6 pb-4">
          <WorkingProjectsSection
            projects={workingProjects}
            isAdmin={isAdmin}
            currentUserId={user.id}
          />

          <NotificationsSection notifications={notifications} />
        </div>
      </div>
    </div>
  )
}
