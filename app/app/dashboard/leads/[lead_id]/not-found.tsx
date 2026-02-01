import Link from 'next/link'
import { DashboardLayout } from '@/app/components/dashboard/dashboard-layout'
import { requireAuth } from '@/lib/auth/utils'

export default async function LeadNotFound() {
  const user = await requireAuth()

  return (
    <DashboardLayout
      pageTitle="Lead Not Found"
      userEmail={user.email}
      userFullName={user.fullName}
      userRole={user.role}
    >
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-[#1E1B4B]">Lead Not Found</h2>
          <p className="mt-2 text-sm text-gray-600">
            The lead you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/leads"
              className="inline-flex items-center gap-2 rounded-lg bg-[#06B6D4] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#0891b2] hover:shadow-md"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Leads
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

