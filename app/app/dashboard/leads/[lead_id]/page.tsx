import { requireAuth } from '@/lib/auth/utils'
import { DashboardLayout } from '@/app/components/dashboard/dashboard-layout'
import { getLead } from '@/lib/leads/actions'
import { notFound, redirect } from 'next/navigation'
import { LeadDetailView } from './lead-detail-view'

import Link from 'next/link'

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
      breadcrumb={
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/dashboard/leads"
            className="font-medium text-[#06B6D4] hover:text-[#0891b2] hover:underline transition-colors"
          >
            Leads
          </Link>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-['Poppins',sans-serif] text-lg font-bold text-[#0C4A6E]">Lead Details</span>
        </div>
      }
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


