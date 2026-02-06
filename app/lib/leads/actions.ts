'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'

export type LeadStatus = 'new' | 'contacted' | 'follow_up' | 'converted' | 'lost'

export type LeadFormData = {
  name: string
  company_name?: string
  phone: string
  source?: string
  status: LeadStatus
  follow_up_date?: string
  notes?: string
}

export type Lead = {
  id: string
  name: string
  company_name: string | null
  phone: string
  source: string | null
  status: LeadStatus
  follow_up_date: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export async function createLead(formData: LeadFormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to create a lead',
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.leads, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to create a lead',
    }
  }

  const supabase = await createClient()

  // Validate required fields
  if (!formData.name || !formData.phone || !formData.status) {
    return {
      error: 'Name, phone, and status are required',
    }
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({
      name: formData.name,
      company_name: formData.company_name || null,
      phone: formData.phone,
      source: formData.source || null,
      status: formData.status,
      follow_up_date: formData.follow_up_date || null,
      notes: formData.notes || null,
      created_by: currentUser.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating lead:', error)
    return {
      error: error.message || 'Failed to create lead',
    }
  }

  revalidatePath('/dashboard/leads')
  return { data, error: null }
}

/**
 * Update an existing lead
 * 
 * Business Rule:
 * - The follow_up_date field in the lead form sets leads.next_follow_up_date directly
 * - This does NOT create a follow-up record automatically
 * - If follow-up records exist, they will override this on next follow-up creation/update
 */
export async function updateLead(leadId: string, formData: LeadFormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to update a lead',
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.leads, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to update this lead',
    }
  }

  const supabase = await createClient()

  // Check if lead exists (RLS will handle access, but we check for better error messages)
  const { data: existingLead, error: fetchError } = await supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .single()

  if (fetchError || !existingLead) {
    return {
      error: 'Lead not found',
    }
  }

  // Validate required fields
  if (!formData.name || !formData.phone || !formData.status) {
    return {
      error: 'Name, phone, and status are required',
    }
  }

  // Update lead with optional next_follow_up_date
  // Note: This sets the lead's next_follow_up_date directly, does NOT create a follow-up record
  // If follow-up records exist, they will override this on next follow-up creation/update
  const { data, error } = await supabase
    .from('leads')
    .update({
      name: formData.name,
      company_name: formData.company_name || null,
      phone: formData.phone,
      source: formData.source || null,
      status: formData.status,
      follow_up_date: formData.follow_up_date || null, // Sets next_follow_up_date directly
      notes: formData.notes || null,
    })
    .eq('id', leadId)
    .select()
    .single()

  if (error) {
    console.error('Error updating lead:', error)
    return {
      error: error.message || 'Failed to update lead',
    }
  }

  revalidatePath('/dashboard/leads')
  return { data, error: null }
}

export async function getLead(leadId: string): Promise<{ data: Lead | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to view a lead',
      data: null,
    }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.leads, 'read')
  if (!canRead) {
    return {
      error: 'You do not have permission to view this lead',
      data: null,
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (error) {
    console.error('Error fetching lead:', error)
    return {
      error: error.message || 'Failed to fetch lead',
      data: null,
    }
  }

  return { data, error: null }
}

export async function deleteLead(leadId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to delete a lead',
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.leads, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to delete this lead',
    }
  }

  const supabase = await createClient()

  // Check if lead exists (RLS will handle access, but we check for better error messages)
  const { data: existingLead, error: fetchError } = await supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .single()

  if (fetchError || !existingLead) {
    return {
      error: 'Lead not found',
    }
  }

  const { error } = await supabase.from('leads').delete().eq('id', leadId)

  if (error) {
    console.error('Error deleting lead:', error)
    return {
      error: error.message || 'Failed to delete lead',
    }
  }

  revalidatePath('/dashboard/leads')
  return { error: null }
}

export type LeadFollowUp = {
  id: string
  lead_id: string
  note: string | null
  follow_up_date: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export async function getLeadFollowUps(leadId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to view follow-ups',
      data: null,
    }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.leads, 'read')
  if (!canRead) {
    return {
      error: 'You do not have permission to view follow-ups',
      data: null,
    }
  }

  const supabase = await createClient()

  // Fetch follow-ups for the lead, ordered by created_at ASC (oldest first, newest last)
  // RLS will automatically filter based on user permissions
  const { data: followUps, error } = await supabase
    .from('lead_followups')
    .select('*')
    .eq('lead_id', leadId)
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
    lead_id: item.lead_id,
    note: item.note,
    follow_up_date: item.follow_up_date,
    created_by: item.created_by,
    created_by_name: userMap.get(item.created_by) || 'Unknown User',
    created_at: item.created_at,
    updated_at: item.updated_at,
  }))

  return { data: transformedData, error: null }
}

export type LeadFollowUpFormData = {
  follow_up_date?: string
  note?: string
}

/**
 * Helper function to update lead's follow_up_date based on follow-up records
 *
 * Business Rule:
 * - The lead's follow_up_date always reflects the latest added follow-up record
 * - Specifically, we use the most recently created follow-up's follow_up_date
 * - If no follow-ups exist, set to null
 */
async function updateLeadFollowUpDate(leadId: string) {
  const supabase = await createClient()

  // Get the latest created follow-up for this lead
  const { data: followUps, error: fetchError } = await supabase
    .from('lead_followups')
    .select('follow_up_date, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (fetchError) {
    console.error('Error fetching follow-ups for date sync:', fetchError)
    return
  }

  // Convert DATE to TIMESTAMP WITH TIME ZONE for leads table
  // Set to the latest created follow-up's date, or null if none exist
  const latestFollowUpDate = followUps?.[0]?.follow_up_date
  const nextFollowUpDate = latestFollowUpDate
    ? new Date(latestFollowUpDate + 'T00:00:00Z').toISOString()
    : null

  // Update the lead's follow_up_date to keep it synchronized
  const { error: updateError } = await supabase
    .from('leads')
    .update({ follow_up_date: nextFollowUpDate })
    .eq('id', leadId)

  if (updateError) {
    console.error('Error updating lead follow-up date:', updateError)
  }
}

/**
 * Create a new follow-up record
 * 
 * Business Rules:
 * - A follow-up record represents a follow-up that has already been taken
 * - The note field describes what discussion/action happened in that follow-up
 * - The follow_up_date field represents the NEXT follow-up date decided during that follow-up
 * - After creation, the lead's follow_up_date is set to the latest added follow-up
 */
export async function createLeadFollowUp(
  leadId: string,
  formData: LeadFollowUpFormData
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to create a follow-up',
      data: null,
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.leads, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to create follow-ups',
      data: null,
    }
  }

  const supabase = await createClient()

  // Validate: at least one of note or follow_up_date must be provided
  if (!formData.note?.trim() && !formData.follow_up_date) {
    return {
      error: 'Please add a note or set a reminder date (at least one is required)',
      data: null,
    }
  }

  // Insert follow-up record
  // Note: follow_up_date here is the NEXT follow-up date (not when the note was written)
  // Both note and follow_up_date are optional, but at least one must be provided
  const { data, error } = await supabase
    .from('lead_followups')
    .insert({
      lead_id: leadId,
      note: formData.note?.trim() || null,
      follow_up_date: formData.follow_up_date || null, // Optional: This is the NEXT follow-up date
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

  // Update lead's follow_up_date to match the latest added follow-up
  await updateLeadFollowUpDate(leadId)

  revalidatePath('/dashboard/leads')
  return { data, error: null }
}

export async function updateLeadFollowUp(
  followUpId: string,
  formData: LeadFollowUpFormData
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to update a follow-up',
      data: null,
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.leads, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to update follow-ups',
      data: null,
    }
  }

  const supabase = await createClient()

  // Check if follow-up exists (RLS will handle access, but we check for better error messages)
  const { data: existingFollowUp, error: fetchError } = await supabase
    .from('lead_followups')
    .select('lead_id')
    .eq('id', followUpId)
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

  // Update follow-up
  const { data, error } = await supabase
    .from('lead_followups')
    .update({
      note: formData.note?.trim() || null,
      follow_up_date: formData.follow_up_date || null,
    })
    .eq('id', followUpId)
    .select()
    .single()

  if (error) {
    console.error('Error updating follow-up:', error)
    return {
      error: error.message || 'Failed to update follow-up',
      data: null,
    }
  }

  // Update lead's follow_up_date
  await updateLeadFollowUpDate(existingFollowUp.lead_id)

  revalidatePath('/dashboard/leads')
  return { data, error: null }
}

/**
 * Delete a follow-up record
 *
 * Business Rules:
 * - Only creator or admin can delete
 * - After deletion, lead.follow_up_date is set to the latest remaining follow-up date, or null if none exist
 */
export async function deleteLeadFollowUp(followUpId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: 'You must be logged in to delete a follow-up',
    }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.leads, 'write')
  if (!canWrite) {
    return {
      error: 'You do not have permission to delete follow-ups',
    }
  }

  const supabase = await createClient()

  // Check if follow-up exists (RLS will handle access, but we check for better error messages)
  const { data: existingFollowUp, error: fetchError } = await supabase
    .from('lead_followups')
    .select('lead_id')
    .eq('id', followUpId)
    .single()

  if (fetchError || !existingFollowUp) {
    return {
      error: 'Follow-up not found',
    }
  }

  // Delete follow-up
  const { error } = await supabase
    .from('lead_followups')
    .delete()
    .eq('id', followUpId)

  if (error) {
    console.error('Error deleting follow-up:', error)
    return {
      error: error.message || 'Failed to delete follow-up',
    }
  }

  // Update lead.follow_up_date after deletion (latest remaining, or null)
  await updateLeadFollowUpDate(existingFollowUp.lead_id)

  revalidatePath('/dashboard/leads')
  return { error: null }
}
