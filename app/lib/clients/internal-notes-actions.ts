'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'
import {
  INTERNAL_NOTE_ALLOWED_MIME_TYPES,
  INTERNAL_NOTE_MAX_ATTACHMENT_SIZE_BYTES,
  INTERNAL_NOTE_MAX_ATTACHMENTS,
  INTERNAL_NOTE_CLOUDINARY_FOLDER,
  getFileCategoryFromMime,
} from './internal-notes-constants'

type CloudinaryUploadSignature = {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  folder: string
}

export type ClientInternalNoteAttachmentInput = {
  file_name: string
  mime_type: string
  size_bytes: number
  cloudinary_url: string
  cloudinary_public_id: string
  resource_type: string
}

export type ClientInternalNoteAttachment = ClientInternalNoteAttachmentInput & {
  id: string
  note_id: string
  client_id: string
  created_at: string
}

export type ClientInternalNote = {
  id: string
  client_id: string
  note_text: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
  attachments: ClientInternalNoteAttachment[]
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

function isAdminOrManager(role?: string | null) {
  return role === 'admin' || role === 'manager'
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

export async function getCloudinaryUploadSignature(): Promise<{
  data: CloudinaryUploadSignature | null
  error: string | null
}> {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdminOrManager(currentUser.role)) {
    return { data: null, error: 'You do not have permission to upload attachments.' }
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const folder = INTERNAL_NOTE_CLOUDINARY_FOLDER
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

export async function getClientInternalNotes(
  clientId: string
): Promise<{ data: ClientInternalNote[] | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdminOrManager(currentUser.role)) {
    return {
      data: null,
      error: 'You do not have permission to view internal notes.',
    }
  }

  const supabase = await createSupabaseClient()

  const { data: notes, error } = await supabase
    .from('client_internal_notes')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching internal notes:', error)
    return { data: null, error: error.message || 'Failed to fetch internal notes' }
  }

  if (!notes || notes.length === 0) {
    return { data: [], error: null }
  }

  const noteIds = notes.map((note) => note.id)

  const { data: attachments } = await supabase
    .from('client_note_attachments')
    .select('*')
    .in('note_id', noteIds)
    .order('created_at', { ascending: true })

  const userIds = [...new Set(notes.map((note) => note.created_by))]
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', userIds)

  const userMap = new Map<string, string>()
  users?.forEach((user) => {
    userMap.set(user.id, user.full_name || 'Unknown User')
  })

  const attachmentsByNote = new Map<string, ClientInternalNoteAttachment[]>()
  attachments?.forEach((attachment) => {
    const existing = attachmentsByNote.get(attachment.note_id) || []
    existing.push({
      id: attachment.id,
      note_id: attachment.note_id,
      client_id: attachment.client_id,
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

  const transformedNotes: ClientInternalNote[] = notes.map((note) => ({
    id: note.id,
    client_id: note.client_id,
    note_text: note.note_text,
    created_by: note.created_by,
    created_by_name: userMap.get(note.created_by) || 'Unknown User',
    created_at: note.created_at,
    updated_at: note.updated_at,
    attachments: attachmentsByNote.get(note.id) || [],
  }))

  return { data: transformedNotes, error: null }
}

export async function createClientInternalNote(
  clientId: string,
  noteText?: string,
  attachments: ClientInternalNoteAttachmentInput[] = []
): Promise<{ data: ClientInternalNote | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdminOrManager(currentUser.role)) {
    return {
      data: null,
      error: 'You do not have permission to create internal notes.',
    }
  }

  const trimmedNote = noteText?.trim() || ''
  const hasNote = trimmedNote.length > 0
  const hasAttachments = attachments.length > 0

  if (!hasNote && !hasAttachments) {
    return {
      data: null,
      error: 'Please add a note or attach at least one file.',
    }
  }

  if (attachments.length > INTERNAL_NOTE_MAX_ATTACHMENTS) {
    return {
      data: null,
      error: `You can upload up to ${INTERNAL_NOTE_MAX_ATTACHMENTS} attachments at once.`,
    }
  }

  // Validate all attachments
  if (attachments.length > 0) {
    // Check MIME types and file sizes
    for (const attachment of attachments) {
      if (!INTERNAL_NOTE_ALLOWED_MIME_TYPES.includes(attachment.mime_type as any)) {
        return {
          data: null,
          error: 'One or more attachments are not an allowed file type.',
        }
      }
      if (attachment.size_bytes > INTERNAL_NOTE_MAX_ATTACHMENT_SIZE_BYTES) {
        return {
          data: null,
          error: 'One or more attachments exceed the 2 MB limit.',
        }
      }
    }

    // Validate all attachments belong to the same category
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

  const supabase = await createSupabaseClient()

  const { data: note, error: noteError } = await supabase
    .from('client_internal_notes')
    .insert({
      client_id: clientId,
      note_text: hasNote ? trimmedNote : null,
      created_by: currentUser.id,
    })
    .select()
    .single()

  if (noteError || !note) {
    console.error('Error creating internal note:', noteError)
    if (attachments.length > 0) {
      await deleteCloudinaryAssets(
        attachments.map((attachment) => ({
          publicId: attachment.cloudinary_public_id,
          resourceType: attachment.resource_type,
        }))
      )
    }
    return {
      data: null,
      error: noteError?.message || 'Failed to create internal note',
    }
  }

  if (attachments.length > 0) {
    const { error: attachmentError } = await supabase
      .from('client_note_attachments')
      .insert(
        attachments.map((attachment) => ({
          note_id: note.id,
          client_id: clientId,
          file_name: attachment.file_name,
          mime_type: attachment.mime_type,
          size_bytes: attachment.size_bytes,
          cloudinary_url: attachment.cloudinary_url,
          cloudinary_public_id: attachment.cloudinary_public_id,
          resource_type: attachment.resource_type,
          created_by: currentUser.id,
        }))
      )

    if (attachmentError) {
      console.error('Error saving note attachments:', attachmentError)
      await supabase.from('client_internal_notes').delete().eq('id', note.id)
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

  revalidatePath('/dashboard/clients')
  revalidatePath(`/dashboard/clients/${clientId}`)

  return {
    data: {
      id: note.id,
      client_id: note.client_id,
      note_text: note.note_text,
      created_by: note.created_by,
      created_by_name: currentUser.fullName || 'You',
      created_at: note.created_at,
      updated_at: note.updated_at,
      attachments: [],
    },
    error: null,
  }
}

export async function updateClientInternalNote(
  noteId: string,
  noteText: string
): Promise<{ data: ClientInternalNote | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdminOrManager(currentUser.role)) {
    return {
      data: null,
      error: 'You do not have permission to update internal notes.',
    }
  }

  const trimmedNote = noteText?.trim() || ''
  if (!trimmedNote) {
    return {
      data: null,
      error: 'Note text cannot be empty.',
    }
  }

  const supabase = await createSupabaseClient()

  const { data: note, error: noteError } = await supabase
    .from('client_internal_notes')
    .update({
      note_text: trimmedNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select()
    .single()

  if (noteError || !note) {
    console.error('Error updating internal note:', noteError)
    return {
      data: null,
      error: noteError?.message || 'Failed to update internal note',
    }
  }

  // Fetch attachments for the note
  const { data: attachments } = await supabase
    .from('client_note_attachments')
    .select('*')
    .eq('note_id', noteId)
    .order('created_at', { ascending: true })

  const { data: user } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', note.created_by)
    .single()

  const transformedNote: ClientInternalNote = {
    id: note.id,
    client_id: note.client_id,
    note_text: note.note_text,
    created_by: note.created_by,
    created_by_name: user?.full_name || 'Unknown User',
    created_at: note.created_at,
    updated_at: note.updated_at,
    attachments: (attachments || []).map((attachment) => ({
      id: attachment.id,
      note_id: attachment.note_id,
      client_id: attachment.client_id,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes,
      cloudinary_url: attachment.cloudinary_url,
      cloudinary_public_id: attachment.cloudinary_public_id,
      resource_type: attachment.resource_type,
      created_at: attachment.created_at,
    })),
  }

  revalidatePath('/dashboard/clients')
  revalidatePath(`/dashboard/clients/${note.client_id}`)

  return { data: transformedNote, error: null }
}

export async function deleteClientInternalNote(
  noteId: string
): Promise<{ error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdminOrManager(currentUser.role)) {
    return {
      error: 'You do not have permission to delete internal notes.',
    }
  }

  const supabase = await createSupabaseClient()

  const { data: attachments } = await supabase
    .from('client_note_attachments')
    .select('cloudinary_public_id, resource_type')
    .eq('note_id', noteId)

  const { data: note, error: noteError } = await supabase
    .from('client_internal_notes')
    .select('client_id')
    .eq('id', noteId)
    .single()

  if (noteError || !note) {
    return { error: noteError?.message || 'Note not found' }
  }

  const { error: deleteError } = await supabase
    .from('client_internal_notes')
    .delete()
    .eq('id', noteId)

  if (deleteError) {
    return { error: deleteError.message || 'Failed to delete note' }
  }

  if (attachments && attachments.length > 0) {
    await deleteCloudinaryAssets(
      attachments.map((attachment) => ({
        publicId: attachment.cloudinary_public_id,
        resourceType: attachment.resource_type,
      }))
    )
  }

  revalidatePath('/dashboard/clients')
  revalidatePath(`/dashboard/clients/${note.client_id}`)

  return { error: null }
}

export async function deleteClientNoteAttachment(
  attachmentId: string
): Promise<{ error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser || !isAdminOrManager(currentUser.role)) {
    return {
      error: 'You do not have permission to delete attachments.',
    }
  }

  const supabase = await createSupabaseClient()

  // Get attachment info before deleting
  const { data: attachment, error: attachmentError } = await supabase
    .from('client_note_attachments')
    .select('cloudinary_public_id, resource_type, note_id, client_id')
    .eq('id', attachmentId)
    .single()

  if (attachmentError || !attachment) {
    return { error: attachmentError?.message || 'Attachment not found' }
  }

  // Delete the attachment record
  const { error: deleteError } = await supabase
    .from('client_note_attachments')
    .delete()
    .eq('id', attachmentId)

  if (deleteError) {
    return { error: deleteError.message || 'Failed to delete attachment' }
  }

  // Delete from Cloudinary
  await deleteCloudinaryAssets([
    {
      publicId: attachment.cloudinary_public_id,
      resourceType: attachment.resource_type,
    },
  ])

  revalidatePath('/dashboard/clients')
  revalidatePath(`/dashboard/clients/${attachment.client_id}`)

  return { error: null }
}
