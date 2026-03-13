import { redirect } from 'next/navigation'
import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'

interface ProductClientsRouteProps {
  params: Promise<{ product_id: string }>
}

export default async function ProductClientsRoute({ params }: ProductClientsRouteProps) {
  const user = await requireAuth()
  const { product_id } = await params

  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.products, 'read')
  const isAdminOrManager = user.role === 'admin' || user.role === 'manager'

  if (!canRead && !isAdminOrManager) {
    redirect('/dashboard?error=unauthorized')
  }

  redirect(`/dashboard/products/${product_id}?tab=clients`)
}

