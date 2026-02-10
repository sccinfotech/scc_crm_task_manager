'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'
import {
  PROJECT_NOTE_ALLOWED_MIME_TYPES,
  PROJECT_NOTE_MAX_ATTACHMENT_SIZE_BYTES,
  PROJECT_NOTE_MAX_ATTACHMENTS,
  PROJECT_NOTE_CLOUDINARY_FOLDER,
  getFileCategoryFromMime,
} from './my-notes-constants'

type CloudinaryUploadSignature = {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  folder: string
}

export type ProjectMyNoteAttachmentInput = {
  file_name: string
  mime_type: string
  size_bytes: number
  cloudinary_url: string
  cloudinary_public_id: string
  resource_type: string
}

export type ProjectMyNoteAttachment = ProjectMyNoteAttachmentInput & {
  id: string
  note_id: string
  project_id: string
  created_at: string
}

export type ProjectMyNote = {
  id: string
  project_id: string
  user_id: string
  note_text: string
  created_at: string
  updated_at: string
  attachments: ProjectMyNoteAttachment[]
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

function getEnvVar(name: string, isPublic = false): string {
  const value = process.env[name]
  if (!value) {
    const visibility = isPublic ? 'public' : 'server-only'
    throw new Error(
      `Missing required ${visibility} environment variable: ${name}. ` +
        'Add it to .env.local and restart the dev server.'
    )
  }
  return value
}

function getCloudinaryConfig() {
  const cloudName = getEnvVar('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', true)
  const apiKey = getEnvVar('NEXT_PUBLIC_CLOUDINARY_API_KEY', true)
  const apiSecret = getEnvVar('CLOUDINARY_API_SECRET', false)

  return { cloudName, apiKey, apiSecret }
}

function signCloudinaryParams(params: Record<string, string | number>, apiSecret: string) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return crypto.createHash('sha1').update(sorted + apiSecret).digest('hex')
}

async function deleteCloudinaryAssets(
  assets: Array<{ publicId: string; resourceType: string }>
) {
  if (assets.length === 0) return
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)

  await Promise.all(
    assets.map(async (asset) => {
      const signature = signCloudinaryParams(
        { public_id: asset.publicId, timestamp },
        apiSecret
      )
      const body = new URLSearchParams({
        public_id: asset.publicId,
        timestamp: String(timestamp),
        api_key: apiKey,
        signature,
      })

      const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${asset.resourceType}/destroy`

      try {
        await fetch(endpoint, {
          method: 'POST',
          body,
        })
      } catch (error) {
        console.error('Cloudinary cleanup failed:', error)
      }
    })
  )
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

export async function getProjectMyNotesUploadSignature(
  projectId: string
): Promise<{ data: CloudinaryUploadSignature | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isEligibleRole(currentUser.role)) {
    return { data: null, error: 'You do not have permission to upload attachments.' }
  }

  const supabase = await createClient()
  if (needsAssignment(currentUser.role)) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to upload attachments.' }
    }
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const folder = PROJECT_NOTE_CLOUDINARY_FOLDER
  const signature = signCloudinaryParams({ timestamp, folder }, apiSecret)

  return {
    data: {
      signature,
      timestamp,
      cloudName,
      apiKey,
      folder,
    },
    error: null,
  }
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

  const notesList = (data as Array<{
    id: string
    project_id: string
    user_id: string
    note_text: string
    created_at: string
    updated_at: string
  }>) || []

  if (notesList.length === 0) {
    return { data: [], error: null }
  }

  const noteIds = notesList.map((note) => note.id)
  const { data: attachments } = await supabase
    .from('project_note_attachments')
    .select('*')
    .in('note_id', noteIds)
    .order('created_at', { ascending: true })

  type AttachmentRow = {
    id: string
    note_id: string
    project_id: string
    file_name: string
    mime_type: string
    size_bytes: number
    cloudinary_url: string
    cloudinary_public_id: string
    resource_type: string
    created_at: string
  }

  const attachmentsByNote = new Map<string, ProjectMyNoteAttachment[]>()
  ;(attachments as AttachmentRow[] | null)?.forEach((attachment) => {
    const existing = attachmentsByNote.get(attachment.note_id) || []
    existing.push({
      id: attachment.id,
      note_id: attachment.note_id,
      project_id: attachment.project_id,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes,
      cloudinary_url: attachment.cloudinary_url,
      cloudinary_public_id: attachment.cloudinary_public_id,
      resource_type: attachment.resource_type,
      created_at: attachment.created_at,
    })
    attachmentsByNote.set(attachment.note_id, existing)
  })

  const transformedNotes: ProjectMyNote[] = notesList.map((note) => ({
    id: note.id,
    project_id: note.project_id,
    user_id: note.user_id,
    note_text: note.note_text,
    created_at: note.created_at,
    updated_at: note.updated_at,
    attachments: attachmentsByNote.get(note.id) || [],
  }))

  return { data: transformedNotes, error: null }
}

export async function createProjectMyNote(
  projectId: string,
  noteText: string,
  attachments: ProjectMyNoteAttachmentInput[] = []
): Promise<ProjectMyNoteActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to create notes.' }
  }
  if (!isEligibleRole(currentUser.role)) {
    return { data: null, error: 'Only staff, admin, and manager users can create notes.' }
  }

  const trimmed = noteText.trim()
  if (!trimmed && attachments.length === 0) {
    return { data: null, error: 'Please add note text or at least one attachment.' }
  }

  if (attachments.length > PROJECT_NOTE_MAX_ATTACHMENTS) {
    return {
      data: null,
      error: `You can upload up to ${PROJECT_NOTE_MAX_ATTACHMENTS} attachments at once.`,
    }
  }

  if (attachments.length > 0) {
    for (const attachment of attachments) {
      if (!PROJECT_NOTE_ALLOWED_MIME_TYPES.includes(attachment.mime_type as any)) {
        return {
          data: null,
          error: 'One or more attachments are not an allowed file type.',
        }
      }
      if (attachment.size_bytes > PROJECT_NOTE_MAX_ATTACHMENT_SIZE_BYTES) {
        return {
          data: null,
          error: 'One or more attachments exceed the 2 MB limit.',
        }
      }
    }

    const firstCategory = getFileCategoryFromMime(attachments[0].mime_type)
    if (!firstCategory) {
      return {
        data: null,
        error: 'Unable to determine file category for attachments.',
      }
    }

    const allSameCategory = attachments.every((attachment) => {
      const category = getFileCategoryFromMime(attachment.mime_type)
      return category === firstCategory
    })

    if (!allSameCategory) {
      return {
        data: null,
        error: 'You can only upload files from the same category (all images or all documents) at once.',
      }
    }
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
      note_text: trimmed || '',
    } as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating project note:', error)
    if (attachments.length > 0) {
      await deleteCloudinaryAssets(
        attachments.map((attachment) => ({
          publicId: attachment.cloudinary_public_id,
          resourceType: attachment.resource_type,
        }))
      )
    }
    return { data: null, error: error.message || 'Failed to create note.' }
  }

  if (attachments.length > 0) {
    const noteRow = data as { id: string; project_id: string; user_id: string; note_text: string; created_at: string; updated_at: string }
    const { error: attachmentError } = await supabase
      .from('project_note_attachments')
      .insert(
        attachments.map((attachment) => ({
          note_id: noteRow.id,
          project_id: projectId,
          file_name: attachment.file_name,
          mime_type: attachment.mime_type,
          size_bytes: attachment.size_bytes,
          cloudinary_url: attachment.cloudinary_url,
          cloudinary_public_id: attachment.cloudinary_public_id,
          resource_type: attachment.resource_type,
          created_by: currentUser.id,
        })) as never
      )

    if (attachmentError) {
      console.error('Error saving project note attachments:', attachmentError)
      await supabase.from('project_user_notes').delete().eq('id', noteRow.id)
      await deleteCloudinaryAssets(
        attachments.map((attachment) => ({
          publicId: attachment.cloudinary_public_id,
          resourceType: attachment.resource_type,
        }))
      )
      return {
        data: null,
        error: attachmentError.message || 'Failed to attach files to note',
      }
    }
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')
  const noteRow = data as { id: string; project_id: string; user_id: string; note_text: string; created_at: string; updated_at: string }
  return {
    data: {
      id: noteRow.id,
      project_id: noteRow.project_id,
      user_id: noteRow.user_id,
      note_text: noteRow.note_text,
      created_at: noteRow.created_at,
      updated_at: noteRow.updated_at,
      attachments: [],
    },
    error: null,
  }
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

  if (!trimmed) {
    const { count } = await supabase
      .from('project_note_attachments')
      .select('*', { count: 'exact', head: true })
      .eq('note_id', noteId)
    if ((count ?? 0) === 0) {
      return { data: null, error: 'Please add note text or at least one attachment.' }
    }
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
    .update({ note_text: trimmed || '' } as never)
    .eq('id', noteId)
    .eq('user_id', currentUser.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating project note:', error)
    return { data: null, error: error.message || 'Failed to update note.' }
  }

  type NoteRow = { id: string; project_id: string; user_id: string; note_text: string; created_at: string; updated_at: string }
  type AttachmentRow = { id: string; note_id: string; project_id: string; file_name: string; mime_type: string; size_bytes: number; cloudinary_url: string; cloudinary_public_id: string; resource_type: string; created_at: string }
  const noteRow = data as NoteRow

  const { data: attachments } = await supabase
    .from('project_note_attachments')
    .select('*')
    .eq('note_id', noteId)
    .order('created_at', { ascending: true })

  const attachmentsList = (attachments as AttachmentRow[] | null) || []
  const transformedNote: ProjectMyNote = {
    id: noteRow.id,
    project_id: noteRow.project_id,
    user_id: noteRow.user_id,
    note_text: noteRow.note_text,
    created_at: noteRow.created_at,
    updated_at: noteRow.updated_at,
    attachments: attachmentsList.map((attachment) => ({
      id: attachment.id,
      note_id: attachment.note_id,
      project_id: attachment.project_id,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes,
      cloudinary_url: attachment.cloudinary_url,
      cloudinary_public_id: attachment.cloudinary_public_id,
      resource_type: attachment.resource_type,
      created_at: attachment.created_at,
    })),
  }

  const projectId = noteRow.project_id
  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')
  return { data: transformedNote, error: null }
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

  const { data: attachments } = await supabase
    .from('project_note_attachments')
    .select('cloudinary_public_id, resource_type')
    .eq('note_id', noteId)

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

  const attachmentsList = attachments as Array<{ cloudinary_public_id: string; resource_type: string }> | null
  if (attachmentsList && attachmentsList.length > 0) {
    await deleteCloudinaryAssets(
      attachmentsList.map((attachment) => ({
        publicId: attachment.cloudinary_public_id,
        resourceType: attachment.resource_type,
      }))
    )
  }

  const projectId = (data as ProjectMyNote).project_id
  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')
  return {
    data: {
      ...(data as ProjectMyNote),
      attachments: [],
    },
    error: null,
  }
}

export async function deleteProjectNoteAttachment(
  attachmentId: string
): Promise<{ error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'You must be logged in to delete attachments.' }
  }
  if (!isEligibleRole(currentUser.role)) {
    return { error: 'You do not have permission to delete attachments.' }
  }

  const supabase = await createClient()
  const { data: attachment, error: attachmentError } = await supabase
    .from('project_note_attachments')
    .select('cloudinary_public_id, resource_type, project_id')
    .eq('id', attachmentId)
    .single()

  if (attachmentError || !attachment) {
    return { error: attachmentError?.message || 'Attachment not found' }
  }

  const { error: deleteError } = await supabase
    .from('project_note_attachments')
    .delete()
    .eq('id', attachmentId)

  if (deleteError) {
    return { error: deleteError.message || 'Failed to delete attachment' }
  }

  await deleteCloudinaryAssets([
    {
      publicId: (attachment as { cloudinary_public_id: string }).cloudinary_public_id,
      resourceType: (attachment as { resource_type: string }).resource_type,
    },
  ])

  const projectId = (attachment as { project_id: string }).project_id
  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')
  return { error: null }
}
