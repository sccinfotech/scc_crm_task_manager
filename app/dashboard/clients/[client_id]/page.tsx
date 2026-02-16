import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { getClient, getClientFollowUps, getLeadFollowUpsForClient } from '@/lib/clients/actions'
import { notFound, redirect } from 'next/navigation'
import { ClientDetailView } from './client-detail-view'
import { Header } from '@/app/components/dashboard/header'
import Link from 'next/link'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'

interface ClientDetailPageProps {
  params: Promise<{ client_id: string }>
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const user = await requireAuth()
  const { client_id } = await params
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.clients, 'read')

  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const [clientResult, clientFollowUpsResult, leadFollowUpsResult] = await Promise.all([
    getClient(client_id),
    getClientFollowUps(client_id),
    getLeadFollowUpsForClient(client_id),
  ])

  if (clientResult.error || !clientResult.data) {
    notFound()
  }

  const client = clientResult.data
  const initialClientFollowUps = clientFollowUpsResult.data ?? []
  const initialLeadFollowUps = leadFollowUpsResult.data ?? []
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.clients, 'write')
  const canManageInternalNotes = user.role === 'admin' || user.role === 'manager'

  const clientName = client.name ?? client.company_name ?? 'Client'
  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href="/dashboard/clients"
        className="font-medium text-[#06B6D4] hover:text-[#0891b2] hover:underline transition-colors"
      >
        Clients
      </Link>
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      <span className="font-['Poppins',sans-serif] text-lg font-bold text-[#0C4A6E] truncate max-w-[200px] sm:max-w-[320px]" title={clientName}>{clientName}</span>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <Header
        pageTitle={clientName}
        breadcrumb={breadcrumb}
      />
      <div className="flex-1 overflow-hidden px-4 lg:px-6 pt-2 lg:pt-3 pb-2">
        <ClientDetailView
          client={client}
          initialClientFollowUps={initialClientFollowUps}
          initialLeadFollowUps={initialLeadFollowUps}
          canWrite={canWrite}
          canManageInternalNotes={canManageInternalNotes}
        />
      </div>
    </div>
  )
}
