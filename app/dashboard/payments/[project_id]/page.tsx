import Link from 'next/link'
import { requireAuth } from '@/lib/auth/utils'
import { redirect, notFound } from 'next/navigation'
import { getProjectPaymentDetail } from '@/lib/payments/actions'
import { PaymentDetailView } from './payment-detail-view'
import { Header } from '@/app/components/dashboard/header'

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ project_id: string }>
}) {
  const user = await requireAuth()
  if (user.role !== 'admin') {
    redirect('/dashboard?error=unauthorized')
  }

  const { project_id } = await params
  const result = await getProjectPaymentDetail(project_id)
  if (result.error || !result.data) {
    notFound()
  }

  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href="/dashboard/payments"
        className="font-medium text-[#06B6D4] hover:underline transition-colors"
      >
        Payments
      </Link>
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      <span className="font-semibold text-[#0C4A6E] truncate max-w-[200px] sm:max-w-[320px]" title={result.data.project.name}>
        {result.data.project.name}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <Header pageTitle={result.data.project.name} breadcrumb={breadcrumb} userId={user.id} />
      <div className="flex-1 overflow-hidden px-2.5 pt-2 pb-2 sm:px-3 lg:px-4">
        <PaymentDetailView detail={result.data} />
      </div>
    </div>
  )
}
