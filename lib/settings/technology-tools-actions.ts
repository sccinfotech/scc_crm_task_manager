'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'

export type TechnologyTool = {
  id: string
  name: string
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export type TechnologyToolFormData = {
  name: string
  is_active?: boolean
}

export async function getTechnologyTools(options?: {
  includeInactive?: boolean
}): Promise<{ data: TechnologyTool[]; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: [], error: 'You must be logged in to view technology tools' }
  }

  const canReadSettings = await hasPermission(currentUser, MODULE_PERMISSION_IDS.settings, 'read')
  const canReadProjects = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'read')
  if (!canReadSettings && !canReadProjects) {
    return { data: [], error: 'You do not have permission to view technology tools' }
  }

  const includeInactive = options?.includeInactive ?? false
  const supabase = await createClient()
  let query = supabase
    .from('technology_tools')
    .select('*')
    .order('name', { ascending: true })

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching technology tools:', error)
    return { data: [], error: error.message || 'Failed to fetch technology tools' }
  }

  return { data: (data || []) as TechnologyTool[], error: null }
}

export async function createTechnologyTool(
  formData: TechnologyToolFormData
): Promise<{ data: TechnologyTool | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to create a technology tool' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.settings, 'write')
  if (!canWrite) {
    return { data: null, error: 'You do not have permission to create technology tools' }
  }

  const name = formData.name?.trim()
  if (!name) {
    return { data: null, error: 'Tool name is required' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('technology_tools')
    .insert({
      name,
      is_active: formData.is_active ?? true,
      created_by: currentUser.id,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating technology tool:', error)
    return { data: null, error: error.message || 'Failed to create technology tool' }
  }

  revalidatePath('/dashboard/settings')
  return { data: data as unknown as TechnologyTool, error: null }
}

export async function updateTechnologyTool(
  toolId: string,
  formData: TechnologyToolFormData
): Promise<{ data: TechnologyTool | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update a technology tool' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.settings, 'write')
  if (!canWrite) {
    return { data: null, error: 'You do not have permission to update technology tools' }
  }

  const name = formData.name?.trim()
  if (!name) {
    return { data: null, error: 'Tool name is required' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('technology_tools')
    .update({
      name,
      is_active: formData.is_active ?? true,
    } as never)
    .eq('id', toolId)
    .select()
    .single()

  if (error) {
    console.error('Error updating technology tool:', error)
    return { data: null, error: error.message || 'Failed to update technology tool' }
  }

  revalidatePath('/dashboard/settings')
  return { data: data as unknown as TechnologyTool, error: null }
}

export async function deleteTechnologyTool(toolId: string): Promise<{ error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'You must be logged in to delete a technology tool' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.settings, 'write')
  if (!canWrite) {
    return { error: 'You do not have permission to delete technology tools' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('technology_tools').delete().eq('id', toolId)

  if (error) {
    console.error('Error deleting technology tool:', error)
    return { error: error.message || 'Failed to delete technology tool' }
  }

  revalidatePath('/dashboard/settings')
  return { error: null }
}
