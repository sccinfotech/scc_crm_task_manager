'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'

export type ClientStatus = 'active' | 'inactive'

export type ClientFormData = {
  name: string
  company_name?: string
  phone: string
  email?: string
  status: ClientStatus
  remark?: string
  lead_id?: string
}

export type Client = {
  id: string
  name: string
  company_name: string | null
  phone: string
  email: string | null
  status: ClientStatus
  remark: string | null
  lead_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type ClientSortField = 'name' | 'company_name' | 'phone' | 'status' | 'created_at'

export type GetClientsPageOptions = {
  search?: string
  status?: ClientStatus | 'all'
  sortField?: ClientSortField
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export type ClientListItem = {
  id: string
  name: string
  company_name: string | null
  phone: string
  email: string | null
  status: ClientStatus
  created_at: string
  created_by?: string
}

export type ClientSelectOption = {
  id: string
  name: string
  company_name: string | null
}

export async function getClientsPage(options: GetClientsPageOptions = {}) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: [], totalCount: 0, error: 'You must be logged in to view clients' }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'read')
  if (!canRead) {
    return { data: [], totalCount: 0, error: 'You do not have permission to view clients' }
  }

  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  const supabase = await createSupabaseClient()

  let query = supabase
    .from('clients')
    .select('id, name, company_name, phone, email, status, created_at, created_by', {
      count: 'exact',
    })

  if (options.search?.trim()) {
    const term = options.search.trim()
    query = query.or(`name.ilike.%${term}%,company_name.ilike.%${term}%`)
  }

  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }

  const sortField = options.sortField ?? 'created_at'
  const sortDirection = options.sortDirection ?? 'desc'
  query = query.order(sortField, { ascending: sortDirection === 'asc' })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Error fetching clients:', error)
    return { data: [], totalCount: 0, error: error.message || 'Failed to fetch clients' }
  }

  return {
    data: (data || []) as ClientListItem[],
    totalCount: count ?? 0,
    error: null,
  }
}

export async function getClientsForSelect(): Promise<{ data: ClientSelectOption[]; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: [], error: 'You must be logged in to view clients' }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'read')
  if (!canRead) {
    return { data: [], error: 'You do not have permission to view clients' }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, company_name')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching clients for select:', error)
    return { data: [], error: error.message || 'Failed to fetch clients' }
  }

  return { data: (data || []) as ClientSelectOption[], error: null }
}

/** Result type for create/update client so callers can narrow on !result.error and use result.data */
export type ClientActionResult =
  | { data: Client; error: null }
  | { data: null; error: string }

export async function createClient(formData: ClientFormData): Promise<ClientActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to create a client',
      data: null,
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to create a client',
      data: null,
    }
  }
  if (formData.lead_id) {
    const canWriteLeads = await hasPermission(currentUser, MODULE_PERMISSION_IDS.leads, 'write')
    if (!canWriteLeads) {
      return {
        error: 'You do not have permission to convert leads',
        data: null,
      }
    }
  }

  const supabase = await createSupabaseClient()

  // Validate required fields
  if (!formData.name || !formData.phone || !formData.status) {
    return {
      error: 'Name, phone, and status are required',
      data: null,
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: formData.name,
      company_name: formData.company_name || null,
      phone: formData.phone,
      email: formData.email || null,
      status: formData.status,
      remark: formData.remark || null,
      lead_id: formData.lead_id || null,
      created_by: currentUser.id,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating client:', error)
    return {
      error: error.message || 'Failed to create client',
      data: null,
    }
  }

  if (formData.lead_id) {
    const { error: followUpError } = await supabase
      .from('lead_client_followups')
      .update({
        client_id: (data as { id: string }).id,
        lead_id: null,
      } as never)
      .eq('lead_id', formData.lead_id)
      .eq('entity_type', 'lead')

    if (followUpError) {
      console.error('Error updating follow-ups during conversion:', followUpError)
      return { error: followUpError.message || 'Client created, but follow-ups failed to transfer', data: null }
    }

    const { error: deleteLeadError } = await supabase
      .from('leads')
      .delete()
      .eq('id', formData.lead_id)

    if (deleteLeadError) {
      console.error('Error deleting lead after conversion:', deleteLeadError)
      return { error: deleteLeadError.message || 'Client created, but lead deletion failed', data: null }
    }

    revalidatePath('/dashboard/leads')
  }

  revalidatePath('/dashboard/clients')
  return { data: data as unknown as Client, error: null }
}

export async function updateClient(clientId: string, formData: ClientFormData): Promise<ClientActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to update a client',
      data: null,
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to update this client',
      data: null,
    }
  }

  const supabase = await createSupabaseClient()

  // Check if client exists
  const { data: existingClient, error: fetchError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .single()

  if (fetchError || !existingClient) {
    return {
      error: 'Client not found',
      data: null,
    }
  }

  // Validate required fields
  if (!formData.name || !formData.phone || !formData.status) {
    return {
      error: 'Name, phone, and status are required',
      data: null,
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .update({
      name: formData.name,
      company_name: formData.company_name || null,
      phone: formData.phone,
      email: formData.email || null,
      status: formData.status,
      remark: formData.remark || null,
    } as never)
    .eq('id', clientId)
    .select()
    .single()

  if (error) {
    console.error('Error updating client:', error)
    return {
      error: error.message || 'Failed to update client',
      data: null,
    }
  }

  revalidatePath('/dashboard/clients')
  return { data: data as unknown as Client, error: null }
}

export async function getClient(clientId: string): Promise<{ data: Client | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to view a client',
      data: null,
    }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'read')
  if (!canRead) {
    return {
      error: 'You do not have permission to view this client',
      data: null,
    }
  }

  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (error) {
    console.error('Error fetching client:', error)
    return {
      error: error.message || 'Failed to fetch client',
      data: null,
    }
  }

  return { data, error: null }
}

export async function deleteClient(clientId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to delete a client',
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to delete this client',
    }
  }

  const supabase = await createSupabaseClient()

  // Check if client exists
  const { data: existingClient, error: fetchError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .single()

  if (fetchError || !existingClient) {
    return {
      error: 'Client not found',
    }
  }

  const { error } = await supabase.from('clients').delete().eq('id', clientId)

  if (error) {
    console.error('Error deleting client:', error)
    return {
      error: error.message || 'Failed to delete client',
    }
  }

  revalidatePath('/dashboard/clients')
  return { error: null }
}

export type ClientFollowUp = {
  id: string
  client_id: string
  note: string | null
  follow_up_date: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export async function getClientFollowUps(clientId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to view follow-ups',
      data: null,
    }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'read')
  if (!canRead) {
    return {
      error: 'You do not have permission to view follow-ups',
      data: null,
    }
  }

  const supabase = await createSupabaseClient()

  // Fetch follow-ups for the client, ordered by created_at ASC (oldest first, newest last)
  const { data: followUps, error } = await supabase
    .from('lead_client_followups')
    .select('*')
    .eq('client_id', clientId)
    .eq('entity_type', 'client')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching follow-ups:', error)
    return {
      error: error.message || 'Failed to fetch follow-ups',
      data: null,
    }
  }

  if (!followUps || followUps.length === 0) {
    return { data: [], error: null }
  }

  type FollowUpRow = { id: string; client_id: string; note: string | null; follow_up_date: string | null; created_by: string; created_at: string; updated_at: string }
  const followUpsList = followUps as FollowUpRow[]
  const userIds = [...new Set(followUpsList.map((fu) => fu.created_by))]
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', userIds)

  const userMap = new Map<string, string>()
  ;(users as Array<{ id: string; full_name: string | null }> | null)?.forEach((user) => {
    userMap.set(user.id, user.full_name || 'Unknown User')
  })

  const transformedData = followUpsList.map((item) => ({
    id: item.id,
    client_id: item.client_id,
    note: item.note,
    follow_up_date: item.follow_up_date,
    created_by: item.created_by,
    created_by_name: userMap.get(item.created_by) || 'Unknown User',
    created_at: item.created_at,
    updated_at: item.updated_at,
  }))

  return { data: transformedData, error: null }
}

export type ClientFollowUpFormData = {
  follow_up_date?: string
  note?: string
}

/** Result type for create/update so callers can narrow on !result.error and use result.data */
export type ClientFollowUpActionResult =
  | { data: ClientFollowUp; error: null }
  | { data: null; error: string }

export async function createClientFollowUp(
  clientId: string,
  formData: ClientFollowUpFormData
): Promise<ClientFollowUpActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to create a follow-up',
      data: null,
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to create follow-ups',
      data: null,
    }
  }

  const supabase = await createSupabaseClient()

  // Validate: at least one of note or follow_up_date must be provided
  if (!formData.note?.trim() && !formData.follow_up_date) {
    return {
      error: 'Please add a note or set a reminder date (at least one is required)',
      data: null,
    }
  }

  const { data, error } = await supabase
    .from('lead_client_followups')
    .insert({
      client_id: clientId,
      entity_type: 'client',
      note: formData.note?.trim() || null,
      follow_up_date: formData.follow_up_date || null, // Optional reminder date
      created_by: currentUser.id,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating follow-up:', error)
    return {
      error: error.message || 'Failed to create follow-up',
      data: null,
    }
  }

  revalidatePath('/dashboard/clients')
  return { data: data as unknown as ClientFollowUp, error: null }
}

export async function updateClientFollowUp(
  followUpId: string,
  formData: ClientFollowUpFormData
): Promise<ClientFollowUpActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to update a follow-up',
      data: null,
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to update follow-ups',
      data: null,
    }
  }

  const supabase = await createSupabaseClient()

  // Check if follow-up exists
  const { data: existingFollowUp, error: fetchError } = await supabase
    .from('lead_client_followups')
    .select('client_id')
    .eq('id', followUpId)
    .eq('entity_type', 'client')
    .single()

  if (fetchError || !existingFollowUp) {
    return {
      error: 'Follow-up not found',
      data: null,
    }
  }

  // Validate: at least one of note or follow_up_date must be provided
  if (!formData.note?.trim() && !formData.follow_up_date) {
    return {
      error: 'Please add a note or set a reminder date (at least one is required)',
      data: null,
    }
  }

  const { data, error } = await supabase
    .from('lead_client_followups')
    .update({
      note: formData.note?.trim() || null,
      follow_up_date: formData.follow_up_date || null, // Optional reminder date
    } as never)
    .eq('id', followUpId)
    .eq('entity_type', 'client')
    .select()
    .single()

  if (error) {
    console.error('Error updating follow-up:', error)
    return {
      error: error.message || 'Failed to update follow-up',
      data: null,
    }
  }

  revalidatePath('/dashboard/clients')
  return { data: data as unknown as ClientFollowUp, error: null }
}

export async function deleteClientFollowUp(followUpId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to delete a follow-up',
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to delete follow-ups',
    }
  }

  const supabase = await createSupabaseClient()

  // Check if follow-up exists
  const { data: existingFollowUp, error: fetchError } = await supabase
    .from('lead_client_followups')
    .select('client_id')
    .eq('id', followUpId)
    .eq('entity_type', 'client')
    .single()

  if (fetchError || !existingFollowUp) {
    return {
      error: 'Follow-up not found',
    }
  }

  const { error } = await supabase
    .from('lead_client_followups')
    .delete()
    .eq('id', followUpId)
    .eq('entity_type', 'client')

  if (error) {
    console.error('Error deleting follow-up:', error)
    return {
      error: error.message || 'Failed to delete follow-up',
    }
  }

  revalidatePath('/dashboard/clients')
  return { error: null }
}

// Get lead-stage follow-ups for a client (from pre-conversion history)
export async function getLeadFollowUpsForClient(clientId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to view lead follow-ups',
      data: null,
    }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'read')
  if (!canRead) {
    return {
      error: 'You do not have permission to view lead follow-ups',
      data: null,
    }
  }

  const supabase = await createSupabaseClient()

  // Fetch follow-ups for the lead, ordered by created_at ASC (oldest first, newest last)
  const { data: followUps, error } = await supabase
    .from('lead_client_followups')
    .select('*')
    .eq('client_id', clientId)
    .eq('entity_type', 'lead')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching lead follow-ups:', error)
    return {
      error: error.message || 'Failed to fetch lead follow-ups',
      data: null,
    }
  }

  if (!followUps || followUps.length === 0) {
    return { data: [], error: null }
  }

  type LeadFollowUpRow = { id: string; client_id: string | null; note: string | null; follow_up_date: string | null; created_by: string; created_at: string; updated_at: string }
  const followUpsList = followUps as LeadFollowUpRow[]
  const userIds = [...new Set(followUpsList.map((fu) => fu.created_by))]
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', userIds)

  const userMap = new Map<string, string>()
  ;(users as Array<{ id: string; full_name: string | null }> | null)?.forEach((user) => {
    userMap.set(user.id, user.full_name || 'Unknown User')
  })

  const transformedData = followUpsList.map((item) => ({
    id: item.id,
    client_id: item.client_id,
    note: item.note,
    follow_up_date: item.follow_up_date,
    created_by: item.created_by,
    created_by_name: userMap.get(item.created_by) || 'Unknown User',
    created_at: item.created_at,
    updated_at: item.updated_at,
  }))

  return { data: transformedData, error: null }
}
