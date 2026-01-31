import { requireAuth } from '@/lib/auth/utils'
import { DashboardLayout } from '@/app/components/dashboard/dashboard-layout'
import { createClient } from '@/lib/supabase/server'
import { LeadsTable } from './leads-table'

async function getLeads() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, company_name, phone, email, status, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching leads:', error)
    return []
  }

  return data || []
}

export default async function LeadsPage() {
  const user = await requireAuth()
  const leads = await getLeads()

  return (
    <DashboardLayout
      pageTitle="Leads"
      userEmail={user.email}
      userFullName={user.fullName}
      userRole={user.role}
    >
      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E1B4B]">Leads</h1>
          <p className="mt-1 text-sm text-gray-600">Manage and track all your leads</p>
        </div>
        {/* Placeholder for future actions */}
        <div className="mt-4 sm:mt-0"></div>
      </div>

      {/* Main Content Card */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <LeadsTable leads={leads} />
      </div>
    </DashboardLayout>
  )
}
