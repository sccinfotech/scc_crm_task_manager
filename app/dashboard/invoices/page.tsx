import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { getInvoicesPage, type InvoicePaymentStatus, getProjectsForInvoiceItemsSelect } from '@/lib/invoices/actions'
import { getClientsForSelect } from '@/lib/clients/actions'
import { InvoicesClient } from './invoices-client'

const PAGE_SIZE = 20

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    sort?: string
    sortDir?: 'asc' | 'desc'
    page?: string
  }>
}) {
  const user = await requireAuth()
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.invoices, 'read')
  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.invoices, 'write')
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const [result, clientsRes, projectsRes] = await Promise.all([
    getInvoicesPage({
      search: params.search,
      status: (params.status as InvoicePaymentStatus | 'all' | undefined) ?? 'all',
      sortField:
        (params.sort as 'invoice_number' | 'invoice_date' | 'grand_total' | 'payment_status' | 'created_at') ??
        'created_at',
      sortDirection: params.sortDir ?? 'desc',
      page,
      pageSize: PAGE_SIZE,
    }),
    getClientsForSelect(),
    getProjectsForInvoiceItemsSelect(),
  ])

  const clients = Array.isArray(clientsRes?.data) ? clientsRes.data : []
  const projects = Array.isArray(projectsRes?.data) ? projectsRes.data : []

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Failed to load invoices: {result.error}</p>
      </div>
    )
  }

  return (
    <InvoicesClient
      invoices={result.data}
      totalCount={result.totalCount}
      page={page}
      pageSize={PAGE_SIZE}
      initialSearch={params.search ?? ''}
      initialStatus={(params.status as InvoicePaymentStatus | 'all') ?? 'all'}
      initialSortField={params.sort ?? 'created_at'}
      initialSortDirection={params.sortDir ?? 'desc'}
      canWrite={canWrite}
      isAdmin={user.role === 'admin'}
      clients={clients}
      projects={projects}
    />
  )
}

