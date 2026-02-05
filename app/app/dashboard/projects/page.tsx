import { requireAuth } from '@/lib/auth/utils'
import { DashboardLayout } from '@/app/components/dashboard/dashboard-layout'

export default async function ProjectsPage() {
  const user = await requireAuth()

  return (
    <DashboardLayout
      pageTitle="Projects"
      userEmail={user.email}
      userFullName={user.fullName}
      userRole={user.role}
    >
      <div className="rounded-lg bg-white p-12 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#06B6D4]/10">
            <svg
              className="h-8 w-8 text-[#06B6D4]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-[#1E1B4B]">Coming Soon</h2>
          <p className="mt-2 text-sm text-gray-600">
            The Projects module is currently under development and will be available soon.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}


