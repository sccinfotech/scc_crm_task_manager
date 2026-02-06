import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { getClient } from '@/lib/clients/actions'
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

  // Fetch client data
  const result = await getClient(client_id)

  if (result.error || !result.data) {
    notFound()
  }

  const client = result.data
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.clients, 'write')
  const canManageInternalNotes = user.role === 'admin' || user.role === 'manager'

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
      <span className="font-['Poppins',sans-serif] text-lg font-bold text-[#0C4A6E]">Client Details</span>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <Header
        pageTitle="Client Details"
        breadcrumb={breadcrumb}
      />
      <div className="flex-1 overflow-hidden px-4 lg:px-6 pt-2 lg:pt-3 pb-2">
        <ClientDetailView
          client={client}
          canWrite={canWrite}
          canManageInternalNotes={canManageInternalNotes}
        />
      </div>
    </div>
  )
}
