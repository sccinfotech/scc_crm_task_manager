import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { getQuotation, getQuotationRequirements } from '@/lib/quotations/actions'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { QuotationDetailView } from './quotation-detail-view'
import { Header } from '@/app/components/dashboard/header'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { getLeadsForSelect } from '@/lib/leads/actions'
import { getClientsForSelect } from '@/lib/clients/actions'
import { getTechnologyTools } from '@/lib/settings/technology-tools-actions'
import { getStaffForSelect } from '@/lib/users/actions'

interface QuotationDetailPageProps {
  params: Promise<{ quotation_id: string }>
}

export default async function QuotationDetailPage({ params }: QuotationDetailPageProps) {
  const user = await requireAuth()
  const { quotation_id } = await params
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.quotations, 'read')
  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const [quotationResult, requirementsResult, leadsRes, clientsRes, toolsRes, staffRes] = await Promise.all([
    getQuotation(quotation_id),
    getQuotationRequirements(quotation_id),
    getLeadsForSelect(),
    getClientsForSelect(),
    getTechnologyTools({ includeInactive: false }),
    getStaffForSelect(),
  ])

  if (quotationResult.error || !quotationResult.data) {
    notFound()
  }

  const quotation = quotationResult.data
  const requirements = requirementsResult.data ?? []
  const { subtotal, discount, final_total } = requirementsResult
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.quotations, 'write')
  const canCreateLead = await hasPermission(user, MODULE_PERMISSION_IDS.leads, 'write')
  const isAdmin = user.role === 'admin'
  const leads = Array.isArray(leadsRes?.data) ? leadsRes.data : []
  const clients = Array.isArray(clientsRes?.data) ? clientsRes.data : []
  const technologyTools = Array.isArray(toolsRes?.data) ? toolsRes.data : []
  const teamMembers = Array.isArray(staffRes?.data) ? staffRes.data : []
  const canViewAmount = user.role === 'admin' || user.role === 'manager'

  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href="/dashboard/quotations"
        className="font-medium text-[#06B6D4] hover:text-[#0891b2] hover:underline transition-colors"
      >
        Quotations
      </Link>
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      <span className="font-bold text-[#0C4A6E] truncate max-w-[200px] sm:max-w-[320px]" title={quotation.quotation_number}>
        {quotation.quotation_number}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <Header pageTitle={quotation.quotation_number} breadcrumb={breadcrumb} />
      <div className="flex-1 overflow-hidden px-4 lg:px-6 pt-2 lg:pt-3 pb-2">
        <QuotationDetailView
          quotation={quotation}
          requirements={requirements}
          subtotal={subtotal}
          discount={discount}
          finalTotal={final_total}
          canWrite={canWrite}
          isAdmin={isAdmin}
          canCreateLead={canCreateLead}
          leads={leads}
          clients={clients}
          technologyTools={technologyTools}
          technologyToolsError={toolsRes.error ?? null}
          teamMembers={teamMembers}
          canViewAmount={canViewAmount}
        />
      </div>
    </div>
  )
}
