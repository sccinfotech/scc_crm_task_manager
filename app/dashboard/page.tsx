import { requireAuth } from '@/lib/auth/utils'
import { getWorkingProjectsForDashboard } from '@/lib/projects/actions'
import { getNotifications } from '@/lib/notifications/actions'
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
    <div className="space-y-6">
      <WorkingProjectsSection
        projects={workingProjects}
        isAdmin={isAdmin}
        currentUserId={user.id}
      />

      <NotificationsSection notifications={notifications} />
    </div>
  )
}
