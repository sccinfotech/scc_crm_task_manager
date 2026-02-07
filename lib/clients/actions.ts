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

export async function createClient(formData: ClientFormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to create a client',
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to create a client',
    }
  }
  if (formData.lead_id) {
    const canWriteLeads = await hasPermission(currentUser, MODULE_PERMISSION_IDS.leads, 'write')
    if (!canWriteLeads) {
      return {
        error: 'You do not have permission to convert leads',
      }
    }
  }

  const supabase = await createSupabaseClient()

  // Validate required fields
  if (!formData.name || !formData.phone || !formData.status) {
    return {
      error: 'Name, phone, and status are required',
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
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating client:', error)
    return {
      error: error.message || 'Failed to create client',
    }
  }

  if (formData.lead_id) {
    const { error: followUpError } = await supabase
      .from('lead_client_followups')
      .update({
        client_id: data.id,
        lead_id: null,
      })
      .eq('lead_id', formData.lead_id)
      .eq('entity_type', 'lead')

    if (followUpError) {
      console.error('Error updating follow-ups during conversion:', followUpError)
      return { error: followUpError.message || 'Client created, but follow-ups failed to transfer' }
    }

    const { error: deleteLeadError } = await supabase
      .from('leads')
      .delete()
      .eq('id', formData.lead_id)

    if (deleteLeadError) {
      console.error('Error deleting lead after conversion:', deleteLeadError)
      return { error: deleteLeadError.message || 'Client created, but lead deletion failed' }
    }

    revalidatePath('/dashboard/leads')
  }

  revalidatePath('/dashboard/clients')
  return { data, error: null }
}

export async function updateClient(clientId: string, formData: ClientFormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to update a client',
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to update this client',
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

  // Validate required fields
  if (!formData.name || !formData.phone || !formData.status) {
    return {
      error: 'Name, phone, and status are required',
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
    })
    .eq('id', clientId)
    .select()
    .single()

  if (error) {
    console.error('Error updating client:', error)
    return {
      error: error.message || 'Failed to update client',
    }
  }

  revalidatePath('/dashboard/clients')
  return { data, error: null }
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

  // Fetch user names for all creators
  const userIds = [...new Set(followUps.map((fu) => fu.created_by))]
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', userIds)

  // Create a map of user IDs to names
  const userMap = new Map<string, string>()
  users?.forEach((user) => {
    userMap.set(user.id, user.full_name || 'Unknown User')
  })

  // Transform the data to include created_by_name
  const transformedData = followUps.map((item) => ({
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
    })
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
    })
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

  // Fetch user names for all creators
  const userIds = [...new Set(followUps.map((fu) => fu.created_by))]
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', userIds)

  // Create a map of user IDs to names
  const userMap = new Map<string, string>()
  users?.forEach((user) => {
    userMap.set(user.id, user.full_name || 'Unknown User')
  })

  // Transform the data to include created_by_name
  const transformedData = followUps.map((item) => ({
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
