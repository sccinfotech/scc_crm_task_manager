import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { LeadsClient } from './leads-client'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { getLeadsPage, type LeadStatus, type FollowUpDateFilter, type LeadSortField } from '@/lib/leads/actions'

const PAGE_SIZE = 20

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    followUp?: string
    sort?: string
    sortDir?: 'asc' | 'desc'
    page?: string
  }>
}) {
  const user = await requireAuth()
  
  // Parallelize permission checks and search params parsing
  const [canRead, canWrite, canCreateClient, params] = await Promise.all([
    hasPermission(user, MODULE_PERMISSION_IDS.leads, 'read'),
    hasPermission(user, MODULE_PERMISSION_IDS.leads, 'write'),
    hasPermission(user, MODULE_PERMISSION_IDS.clients, 'write'),
    searchParams,
  ])

  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const result = await getLeadsPage({
    search: params.search,
    status: (params.status as LeadStatus | undefined) ?? 'all',
    followUpDate: (params.followUp as FollowUpDateFilter | undefined) ?? 'all',
    sortField: (params.sort as LeadSortField | undefined) ?? 'created_at',
    sortDirection: params.sortDir ?? 'desc',
    page,
    pageSize: PAGE_SIZE,
  })

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Failed to load leads: {result.error}</p>
      </div>
    )
  }

  return (
    <LeadsClient
      leads={result.data}
      totalCount={result.totalCount}
      page={page}
      pageSize={PAGE_SIZE}
      initialSearch={params.search ?? ''}
      initialStatus={(params.status as LeadStatus | 'all') ?? 'all'}
      initialFollowUpDate={(params.followUp as FollowUpDateFilter) ?? 'all'}
      initialSortField={(params.sort as LeadSortField) ?? 'created_at'}
      initialSortDirection={params.sortDir ?? 'desc'}
      canWrite={canWrite}
      canCreateClient={canCreateClient}
    />
  )
}
