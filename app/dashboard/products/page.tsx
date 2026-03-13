import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { getProductsPage } from '@/lib/products/actions'
import { getClientsForSelect } from '@/lib/clients/actions'
import { ProductsClient } from './products-client'

const PAGE_SIZE = 20

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    page?: string
  }>
}) {
  const user = await requireAuth()
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.products, 'read')
  const isAdminOrManager = user.role === 'admin' || user.role === 'manager'

  if (!canRead && !isAdminOrManager) {
    redirect('/dashboard?error=unauthorized')
  }

  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.products, 'write')
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const [productsResult, clientsResult] = await Promise.all([
    getProductsPage({
      search: params.search,
      page,
      pageSize: PAGE_SIZE,
    }),
    getClientsForSelect(),
  ])

  if (productsResult.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Failed to load products: {productsResult.error}</p>
      </div>
    )
  }

  return (
    <ProductsClient
      products={productsResult.data}
      totalCount={productsResult.totalCount}
      page={page}
      pageSize={PAGE_SIZE}
      initialSearch={params.search ?? ''}
      canWrite={canWrite || isAdminOrManager}
      clients={clientsResult.data}
      clientsError={clientsResult.error}
    />
  )
}

