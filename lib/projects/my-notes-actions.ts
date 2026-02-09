'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'

export type ProjectMyNote = {
  id: string
  project_id: string
  user_id: string
  note_text: string
  created_at: string
  updated_at: string
}

export type ProjectMyNotesResult = {
  data: ProjectMyNote[] | null
  error: string | null
}

export type ProjectMyNoteActionResult = {
  data: ProjectMyNote | null
  error: string | null
}

function isEligibleRole(role?: string | null) {
  return role === 'staff' || role === 'admin' || role === 'manager'
}

function needsAssignment(role?: string | null) {
  return role === 'staff'
}

async function isUserAssignedToProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('project_team_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return false
  const row = data as { user_id?: string } | null
  return Boolean(row?.user_id)
}

export async function getProjectMyNotes(projectId: string): Promise<ProjectMyNotesResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view notes.' }
  }
  if (!isEligibleRole(currentUser.role)) {
    return { data: null, error: 'Only staff, admin, and manager users can access My Notes.' }
  }

  const supabase = await createClient()
  if (needsAssignment(currentUser.role)) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to view notes for this project.' }
    }
  }

  const { data, error } = await supabase
    .from('project_user_notes')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching project notes:', error)
    return { data: null, error: error.message || 'Failed to fetch notes.' }
  }

  return { data: (data as ProjectMyNote[]) || [], error: null }
}

export async function createProjectMyNote(
  projectId: string,
  noteText: string
): Promise<ProjectMyNoteActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to create notes.' }
  }
  if (!isEligibleRole(currentUser.role)) {
    return { data: null, error: 'Only staff, admin, and manager users can create notes.' }
  }

  const trimmed = noteText.trim()
  if (!trimmed) {
    return { data: null, error: 'Note text is required.' }
  }

  const supabase = await createClient()
  if (needsAssignment(currentUser.role)) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to add notes for this project.' }
    }
  }

  const { data, error } = await supabase
    .from('project_user_notes')
    .insert({
      project_id: projectId,
      user_id: currentUser.id,
      note_text: trimmed,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating project note:', error)
    return { data: null, error: error.message || 'Failed to create note.' }
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')
  return { data: data as ProjectMyNote, error: null }
}

export async function updateProjectMyNote(
  noteId: string,
  noteText: string
): Promise<ProjectMyNoteActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update notes.' }
  }
  if (!isEligibleRole(currentUser.role)) {
    return { data: null, error: 'Only staff, admin, and manager users can update notes.' }
  }

  const trimmed = noteText.trim()
  if (!trimmed) {
    return { data: null, error: 'Note text is required.' }
  }

  const supabase = await createClient()
  const { data: existingNote, error: fetchError } = await supabase
    .from('project_user_notes')
    .select('project_id')
    .eq('id', noteId)
    .eq('user_id', currentUser.id)
    .single()

  if (fetchError || !existingNote) {
    return { data: null, error: 'Note not found.' }
  }

  if (needsAssignment(currentUser.role)) {
    const isAssigned = await isUserAssignedToProject(
      supabase,
      (existingNote as { project_id: string }).project_id,
      currentUser.id
    )
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to update notes for this project.' }
    }
  }

  const { data, error } = await supabase
    .from('project_user_notes')
    .update({ note_text: trimmed } as never)
    .eq('id', noteId)
    .eq('user_id', currentUser.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating project note:', error)
    return { data: null, error: error.message || 'Failed to update note.' }
  }

  const projectId = (data as ProjectMyNote).project_id
  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')
  return { data: data as ProjectMyNote, error: null }
}

export async function deleteProjectMyNote(noteId: string): Promise<ProjectMyNoteActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to delete notes.' }
  }
  if (!isEligibleRole(currentUser.role)) {
    return { data: null, error: 'Only staff, admin, and manager users can delete notes.' }
  }

  const supabase = await createClient()
  const { data: existingNote, error: fetchError } = await supabase
    .from('project_user_notes')
    .select('project_id')
    .eq('id', noteId)
    .eq('user_id', currentUser.id)
    .single()

  if (fetchError || !existingNote) {
    return { data: null, error: 'Note not found.' }
  }

  if (needsAssignment(currentUser.role)) {
    const isAssigned = await isUserAssignedToProject(
      supabase,
      (existingNote as { project_id: string }).project_id,
      currentUser.id
    )
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to delete notes for this project.' }
    }
  }

  const { data, error } = await supabase
    .from('project_user_notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', currentUser.id)
    .select()
    .single()

  if (error) {
    console.error('Error deleting project note:', error)
    return { data: null, error: error.message || 'Failed to delete note.' }
  }

  const projectId = (data as ProjectMyNote).project_id
  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')
  return { data: data as ProjectMyNote, error: null }
}
