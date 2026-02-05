import { requireAuth } from '@/lib/auth/utils'
import { DashboardLayout } from '@/app/components/dashboard/dashboard-layout'

export default async function UsersPage() {
  const user = await requireAuth()

  return (
    <DashboardLayout
      pageTitle="Users"
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-[#1E1B4B]">Coming Soon</h2>
          <p className="mt-2 text-sm text-gray-600">
            The Users module is currently under development and will be available soon.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}


