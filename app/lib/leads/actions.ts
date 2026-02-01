'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'You must be logged in to create a lead',
    }
  }

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
      created_by: user.id,
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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'You must be logged in to update a lead',
    }
  }

  // Check if user can edit this lead (RLS will handle this, but we check for better error messages)
  const { data: existingLead, error: fetchError } = await supabase
    .from('leads')
    .select('created_by')
    .eq('id', leadId)
    .single()

  if (fetchError || !existingLead) {
    return {
      error: 'Lead not found',
    }
  }

  // Check if user is admin or owns the lead
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = userData?.role === 'admin'
  const isOwner = existingLead.created_by === user.id

  if (!isAdmin && !isOwner) {
    return {
      error: 'You do not have permission to edit this lead',
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

export async function getLead(leadId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'You must be logged in to view a lead',
      data: null,
    }
  }

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

  // Check permissions (RLS handles this, but we verify for better UX)
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = userData?.role === 'admin'
  const isOwner = data.created_by === user.id

  if (!isAdmin && !isOwner) {
    return {
      error: 'You do not have permission to view this lead',
      data: null,
    }
  }

  return { data, error: null }
}

export async function deleteLead(leadId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'You must be logged in to delete a lead',
    }
  }

  // Check if user can delete this lead (RLS will handle this, but we check for better error messages)
  const { data: existingLead, error: fetchError } = await supabase
    .from('leads')
    .select('created_by')
    .eq('id', leadId)
    .single()

  if (fetchError || !existingLead) {
    return {
      error: 'Lead not found',
    }
  }

  // Check if user is admin or owns the lead
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = userData?.role === 'admin'
  const isOwner = existingLead.created_by === user.id

  if (!isAdmin && !isOwner) {
    return {
      error: 'You do not have permission to delete this lead',
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
  note: string
  follow_up_date: string
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export async function getLeadFollowUps(leadId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'You must be logged in to view follow-ups',
      data: null,
    }
  }

  // Fetch follow-ups for the lead, ordered by follow_up_date DESC
  // RLS will automatically filter based on user permissions
  const { data: followUps, error } = await supabase
    .from('lead_followups')
    .select('*')
    .eq('lead_id', leadId)
    .order('follow_up_date', { ascending: false })

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
  follow_up_date: string
  note: string
}

/**
 * Helper function to update lead's next_follow_up_date based on follow-up records
 * 
 * Business Rule:
 * - The lead's follow_up_date must always reflect the latest upcoming follow-up date
 * - It is calculated from all follow-up records' follow_up_date fields
 * - Each follow-up record's follow_up_date represents the NEXT follow-up date
 *   decided during that follow-up (not when the note was written)
 * - If no upcoming follow-ups exist, set to null
 */
async function updateLeadFollowUpDate(leadId: string) {
  const supabase = await createClient()

  // Get the earliest upcoming follow-up date (today or future)
  // follow_up_date in lead_followups is DATE type, so we compare as date strings
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayDateString = today.toISOString().split('T')[0]

  const { data: upcomingFollowUps } = await supabase
    .from('lead_followups')
    .select('follow_up_date')
    .eq('lead_id', leadId)
    .gte('follow_up_date', todayDateString)
    .order('follow_up_date', { ascending: true })
    .limit(1)

  // Convert DATE to TIMESTAMP WITH TIME ZONE for leads table
  // Set to the earliest upcoming date, or null if none exist
  const nextFollowUpDate =
    upcomingFollowUps && upcomingFollowUps.length > 0
      ? new Date(upcomingFollowUps[0].follow_up_date + 'T00:00:00Z').toISOString()
      : null

  // Update the lead's follow_up_date to keep it synchronized
  await supabase
    .from('leads')
    .update({ follow_up_date: nextFollowUpDate })
    .eq('id', leadId)
}

/**
 * Create a new follow-up record
 * 
 * Business Rules:
 * - A follow-up record represents a follow-up that has already been taken
 * - The note field describes what discussion/action happened in that follow-up
 * - The follow_up_date field represents the NEXT follow-up date decided during that follow-up
 * - After creation, the lead's next_follow_up_date is recalculated to stay in sync
 */
export async function createLeadFollowUp(
  leadId: string,
  formData: LeadFollowUpFormData
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'You must be logged in to create a follow-up',
      data: null,
    }
  }

  // Validate required fields
  if (!formData.follow_up_date || !formData.note?.trim()) {
    return {
      error: 'Follow-up note and next follow-up date are required',
      data: null,
    }
  }

  // Insert follow-up record
  // Note: follow_up_date here is the NEXT follow-up date (not when the note was written)
  const { data, error } = await supabase
    .from('lead_followups')
    .insert({
      lead_id: leadId,
      note: formData.note.trim(),
      follow_up_date: formData.follow_up_date, // This is the NEXT follow-up date
      created_by: user.id,
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

  // Recalculate and update lead's next_follow_up_date to stay synchronized
  await updateLeadFollowUpDate(leadId)

  revalidatePath('/dashboard/leads')
  return { data, error: null }
}

export async function updateLeadFollowUp(
  followUpId: string,
  formData: LeadFollowUpFormData
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'You must be logged in to update a follow-up',
      data: null,
    }
  }

  // Check if user can edit this follow-up (RLS will handle this, but we check for better error messages)
  const { data: existingFollowUp, error: fetchError } = await supabase
    .from('lead_followups')
    .select('created_by, lead_id')
    .eq('id', followUpId)
    .single()

  if (fetchError || !existingFollowUp) {
    return {
      error: 'Follow-up not found',
      data: null,
    }
  }

  // Check if user is admin or owns the follow-up
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = userData?.role === 'admin'
  const isOwner = existingFollowUp.created_by === user.id

  if (!isAdmin && !isOwner) {
    return {
      error: 'You do not have permission to edit this follow-up',
      data: null,
    }
  }

  // Validate required fields
  if (!formData.follow_up_date || !formData.note?.trim()) {
    return {
      error: 'Follow-up date and note are required',
      data: null,
    }
  }

  // Update follow-up
  const { data, error } = await supabase
    .from('lead_followups')
    .update({
      note: formData.note.trim(),
      follow_up_date: formData.follow_up_date,
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
 * - After deletion, recalculates lead's next_follow_up_date
 * - Uses latest remaining follow-up date, or null if none exist
 */
export async function deleteLeadFollowUp(followUpId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'You must be logged in to delete a follow-up',
    }
  }

  // Check if user can delete this follow-up (RLS will handle this, but we check for better error messages)
  const { data: existingFollowUp, error: fetchError } = await supabase
    .from('lead_followups')
    .select('created_by, lead_id')
    .eq('id', followUpId)
    .single()

  if (fetchError || !existingFollowUp) {
    return {
      error: 'Follow-up not found',
    }
  }

  // Check if user is admin or owns the follow-up
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = userData?.role === 'admin'
  const isOwner = existingFollowUp.created_by === user.id

  if (!isAdmin && !isOwner) {
    return {
      error: 'You do not have permission to delete this follow-up',
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

  // Recalculate lead's next_follow_up_date after deletion
  // This ensures it reflects the latest remaining follow-up date, or null if none exist
  await updateLeadFollowUpDate(existingFollowUp.lead_id)

  revalidatePath('/dashboard/leads')
  return { error: null }
}

