import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { getProduct, type ProductListItem } from '@/lib/products/actions'
import { getClientsForSelect } from '@/lib/clients/actions'
import { Header } from '@/app/components/dashboard/header'
import { ProductDetailView } from './product-detail-view'

interface ProductDetailPageProps {
  params: Promise<{ product_id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: ProductDetailPageProps) {
  const user = await requireAuth()
  const { product_id } = await params
  const query = await searchParams

  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.products, 'read')
  const isAdminOrManager = user.role === 'admin' || user.role === 'manager'

  if (!canRead && !isAdminOrManager) {
    redirect('/dashboard?error=unauthorized')
  }

  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.products, 'write')

  const [productResult, clientsResult] = await Promise.all([
    getProduct(product_id),
    getClientsForSelect(),
  ])

  if (productResult.error || !productResult.data) {
    notFound()
  }

  const product = productResult.data

  const productListLike: ProductListItem = {
    id: product.id,
    name: product.name,
    description: product.description,
    icon_url: product.icon_url,
    is_annual_subscription: product.is_annual_subscription,
    active_client_count: 0,
    expired_client_count: 0,
  }

  const productName = product.name || 'Product'
  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href="/dashboard/products"
        className="font-medium text-[#06B6D4] hover:text-[#0891b2] hover:underline transition-colors"
      >
        Products
      </Link>
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      <span
        className="font-['Poppins',sans-serif] text-lg font-bold text-[#0C4A6E] truncate max-w-[200px] sm:max-w-[320px]"
        title={productName}
      >
        {productName}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <Header pageTitle={productName} breadcrumb={breadcrumb} />
      <div className="flex-1 overflow-hidden px-2.5 pt-2 pb-2 sm:px-3 lg:px-4">
        <ProductDetailView
          product={productListLike}
          clients={clientsResult.data}
          canWrite={canWrite || isAdminOrManager}
          initialTab={query.tab ?? null}
        />
      </div>
    </div>
  )
}

