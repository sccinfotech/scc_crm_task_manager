import { requireAuth } from '@/lib/auth/utils'
import { DashboardLayout } from '@/app/components/dashboard/dashboard-layout'
import { createClient } from '@/lib/supabase/server'
import { LeadsClient } from './leads-client'

async function getLeads() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, company_name, phone, status, created_at, follow_up_date, created_by')
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
      hideHeader={true}
    >
      <LeadsClient
        leads={leads}
        currentUserId={user.id}
        userRole={user.role}
      />
    </DashboardLayout>
  )
}
