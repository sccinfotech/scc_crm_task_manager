import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { QuotationsClient } from './quotations-client'
import {
  getQuotationsPage,
  type QuotationStatus,
  type QuotationSourceType,
} from '@/lib/quotations/actions'
import { getLeadsForSelect } from '@/lib/leads/actions'
import { getClientsForSelect } from '@/lib/clients/actions'
import { getTechnologyTools } from '@/lib/settings/technology-tools-actions'
import { getStaffForSelect } from '@/lib/users/actions'

const PAGE_SIZE = 20

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    source?: string
    tool?: string
    sort?: string
    sortDir?: 'asc' | 'desc'
    page?: string
  }>
}) {
  const user = await requireAuth()
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.quotations, 'read')
  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.quotations, 'write')
  const canCreateLead = await hasPermission(user, MODULE_PERMISSION_IDS.leads, 'write')
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const [result, leadsRes, clientsRes, toolsRes, staffRes] = await Promise.all([
    getQuotationsPage({
    search: params.search,
    status: (params.status as QuotationStatus | undefined) ?? 'all',
    source_type: (params.source as QuotationSourceType | undefined) ?? 'all',
    technology_tool_ids: params.tool ? [params.tool] : undefined,
    sortField: (params.sort as 'quotation_number' | 'valid_till' | 'final_total' | 'status' | 'created_at') ?? 'created_at',
    sortDirection: params.sortDir ?? 'desc',
    page,
    pageSize: PAGE_SIZE,
  }),
    getLeadsForSelect(),
    getClientsForSelect(),
    getTechnologyTools({ includeInactive: false }),
    getStaffForSelect(),
  ])

  const leads = Array.isArray(leadsRes?.data) ? leadsRes.data : []
  const clients = Array.isArray(clientsRes?.data) ? clientsRes.data : []
  const technologyTools = Array.isArray(toolsRes?.data) ? toolsRes.data : []
  const teamMembers = Array.isArray(staffRes?.data) ? staffRes.data : []
  const canViewAmount = user.role === 'admin' || user.role === 'manager'

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Failed to load quotations: {result.error}</p>
      </div>
    )
  }

  return (
    <QuotationsClient
      quotations={result.data}
      totalCount={result.totalCount}
      page={page}
      pageSize={PAGE_SIZE}
      initialSearch={params.search ?? ''}
      initialStatus={(params.status as QuotationStatus | 'all') ?? 'all'}
      initialSourceType={(params.source as QuotationSourceType | 'all') ?? 'all'}
      initialSortField={params.sort ?? 'created_at'}
      initialSortDirection={params.sortDir ?? 'desc'}
      canWrite={canWrite}
      isAdmin={user.role === 'admin'}
      canCreateLead={canCreateLead}
      leads={leads}
      clients={clients}
      technologyTools={technologyTools}
      technologyToolsError={toolsRes.error ?? null}
      teamMembers={teamMembers}
      canViewAmount={canViewAmount}
    />
  )
}
