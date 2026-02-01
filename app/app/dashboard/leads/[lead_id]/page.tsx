import { requireAuth } from '@/lib/auth/utils'
import { DashboardLayout } from '@/app/components/dashboard/dashboard-layout'
import { getLead } from '@/lib/leads/actions'
import { notFound, redirect } from 'next/navigation'
import { LeadDetailView } from './lead-detail-view'

interface LeadDetailPageProps {
  params: Promise<{ lead_id: string }>
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const user = await requireAuth()
  const { lead_id } = await params

  // Fetch lead data
  const result = await getLead(lead_id)

  if (result.error || !result.data) {
    notFound()
  }

  const lead = result.data

  // Check permissions
  const isAdmin = user.role === 'admin'
  const isOwner = lead.created_by === user.id

  if (!isAdmin && !isOwner) {
    redirect('/dashboard/leads')
  }

  return (
    <DashboardLayout
      pageTitle="Lead Details"
      userEmail={user.email}
      userFullName={user.fullName}
      userRole={user.role}
    >
      <LeadDetailView
        lead={lead}
        currentUserId={user.id}
        userRole={user.role}
      />
    </DashboardLayout>
  )
}

