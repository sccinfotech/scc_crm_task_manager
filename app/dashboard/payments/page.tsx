import { requireAuth } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { getPaymentProjectsPage } from '@/lib/payments/actions'
import { PaymentsClient } from './payments-client'

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
  }>
}) {
  const user = await requireAuth()
  if (user.role !== 'admin') {
    redirect('/dashboard?error=unauthorized')
  }

  const params = await searchParams
  const rawStatus = params.status
  const status = rawStatus === 'pending' || rawStatus === 'paid' ? rawStatus : 'all'

  const result = await getPaymentProjectsPage({
    search: params.search,
    status,
  })

  if (result.error) {
    return (
      <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p>Failed to load payments: {result.error}</p>
        </div>
      </div>
    )
  }

  return (
    <PaymentsClient
      projects={result.data ?? []}
      initialSearch={params.search ?? ''}
      initialStatus={status}
    />
  )
}
