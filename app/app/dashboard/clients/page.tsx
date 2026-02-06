import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { ClientsClient } from './clients-client'

async function getClients() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, company_name, phone, email, status, created_at, created_by')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching clients:', error)
    return []
  }

  return data || []
}

export default async function ClientsPage() {
  const user = await requireAuth()
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.clients, 'read')

  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.clients, 'write')
  const canManageInternalNotes = user.role === 'admin' || user.role === 'manager'
  const clients = await getClients()

  return (
    <ClientsClient
      clients={clients}
      canWrite={canWrite}
      canManageInternalNotes={canManageInternalNotes}
    />
  )
}
