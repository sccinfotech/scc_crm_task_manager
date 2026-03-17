import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { ClientsClient } from './clients-client'
import { getClientsPage, type ClientStatus, type ClientSortField, type ClientTypeFilter } from '@/lib/clients/actions'
import { getProductsPage } from '@/lib/products/actions'

const PAGE_SIZE = 20

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    type?: ClientTypeFilter
    productId?: string
    sort?: string
    sortDir?: 'asc' | 'desc'
    page?: string
  }>
}) {
  const user = await requireAuth()
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.clients, 'read')

  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.clients, 'write')
  const canManageInternalNotes = user.role === 'admin' || user.role === 'manager'

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const clientType: ClientTypeFilter = params.type === 'product' ? 'product' : 'all'
  const initialProductId = params.productId

  // Preload products for filter dropdown (used only when viewing Product Clients)
  const productsResult = await getProductsPage({ page: 1, pageSize: 100 })
  const result = await getClientsPage({
    search: params.search,
    status: (params.status as ClientStatus | undefined) ?? 'all',
    clientType: clientType !== 'all' ? clientType : undefined,
    sortField: (params.sort as ClientSortField | undefined) ?? 'created_at',
    sortDirection: params.sortDir ?? 'desc',
    productId: clientType === 'product' ? initialProductId : undefined,
    page,
    pageSize: PAGE_SIZE,
  })

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Failed to load clients: {result.error}</p>
      </div>
    )
  }

  return (
    <ClientsClient
      clients={result.data}
      totalCount={result.totalCount}
      page={page}
      pageSize={PAGE_SIZE}
      initialSearch={params.search ?? ''}
      initialStatus={(params.status as ClientStatus | 'all') ?? 'all'}
      initialClientType={clientType}
      initialProductId={clientType === 'product' ? initialProductId : undefined}
      productOptions={productsResult.data.map((p) => ({ id: p.id, name: p.name }))}
      initialSortField={(params.sort as ClientSortField) ?? 'created_at'}
      initialSortDirection={params.sortDir ?? 'desc'}
      canWrite={canWrite}
      canManageInternalNotes={canManageInternalNotes}
    />
  )
}
