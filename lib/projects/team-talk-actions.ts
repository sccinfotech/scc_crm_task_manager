'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'
import {
  TEAM_TALK_ALLOWED_MIME_TYPES,
  TEAM_TALK_MAX_ATTACHMENT_SIZE_BYTES,
  TEAM_TALK_MAX_ATTACHMENTS,
  TEAM_TALK_CLOUDINARY_FOLDER,
} from './team-talk-constants'

type CloudinaryUploadSignature = {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  folder: string
}

export type ProjectTeamTalkAttachmentInput = {
  file_name: string
  mime_type: string
  size_bytes: number
  cloudinary_url: string
  cloudinary_public_id: string
  resource_type: string
}

export type ProjectTeamTalkAttachment = ProjectTeamTalkAttachmentInput & {
  id: string
  message_id: string
  project_id: string
  created_at: string
}

export type ProjectTeamTalkMessage = {
  id: string
  project_id: string
  message_text: string
  created_by: string
  created_by_name: string
  created_by_email: string | null
  created_at: string
  updated_at: string
  attachments: ProjectTeamTalkAttachment[]
}

export type ProjectTeamTalkResult = {
  data: ProjectTeamTalkMessage[] | null
  error: string | null
}

export type ProjectTeamTalkActionResult = {
  data: ProjectTeamTalkMessage | null
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

export async function getProjectTeamTalkUploadSignature(
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
  const folder = TEAM_TALK_CLOUDINARY_FOLDER
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

export async function getProjectTeamTalkMessages(projectId: string): Promise<ProjectTeamTalkResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view Team Talk.' }
  }
  if (!isEligibleRole(currentUser.role)) {
    return { data: null, error: 'Only staff, admin, and manager users can access Team Talk.' }
  }

  const supabase = await createClient()
  if (needsAssignment(currentUser.role)) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to view this project conversation.' }
    }
  }

  const { data: messages, error } = await supabase
    .from('project_team_talk_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching Team Talk messages:', error)
    return { data: null, error: error.message || 'Failed to fetch messages.' }
  }

  const messageList =
    (messages as Array<{
      id: string
      project_id: string
      message_text: string
      created_by: string
      created_at: string
      updated_at: string
    }>) || []

  if (messageList.length === 0) {
    return { data: [], error: null }
  }

  const messageIds = messageList.map((message) => message.id)
  const { data: attachments } = await supabase
    .from('project_team_talk_attachments')
    .select('*')
    .in('message_id', messageIds)
    .order('created_at', { ascending: true })

  type AttachmentRow = {
    id: string
    message_id: string
    project_id: string
    file_name: string
    mime_type: string
    size_bytes: number
    cloudinary_url: string
    cloudinary_public_id: string
    resource_type: string
    created_at: string
  }

  const attachmentsByMessage = new Map<string, ProjectTeamTalkAttachment[]>()
  ;(attachments as AttachmentRow[] | null)?.forEach((attachment) => {
    const existing = attachmentsByMessage.get(attachment.message_id) || []
    existing.push({
      id: attachment.id,
      message_id: attachment.message_id,
      project_id: attachment.project_id,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      size_bytes: attachment.size_bytes,
      cloudinary_url: attachment.cloudinary_url,
      cloudinary_public_id: attachment.cloudinary_public_id,
      resource_type: attachment.resource_type,
      created_at: attachment.created_at,
    })
    attachmentsByMessage.set(attachment.message_id, existing)
  })

  const userIds = [...new Set(messageList.map((message) => message.created_by))]
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email')
    .in('id', userIds)

  const userNameMap = new Map<string, string>()
  const userEmailMap = new Map<string, string | null>()
  ;(users as Array<{ id: string; full_name: string | null; email: string | null }> | null)?.forEach(
    (user) => {
      userNameMap.set(user.id, user.full_name || 'Unknown User')
      userEmailMap.set(user.id, user.email)
    }
  )

  const transformedMessages: ProjectTeamTalkMessage[] = messageList.map((message) => ({
    id: message.id,
    project_id: message.project_id,
    message_text: message.message_text,
    created_by: message.created_by,
    created_by_name: userNameMap.get(message.created_by) || 'Unknown User',
    created_by_email: userEmailMap.get(message.created_by) || null,
    created_at: message.created_at,
    updated_at: message.updated_at,
    attachments: attachmentsByMessage.get(message.id) || [],
  }))

  return { data: transformedMessages, error: null }
}

export async function createProjectTeamTalkMessage(
  projectId: string,
  messageText: string,
  attachments: ProjectTeamTalkAttachmentInput[] = []
): Promise<ProjectTeamTalkActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to send messages.' }
  }
  if (!isEligibleRole(currentUser.role)) {
    return { data: null, error: 'Only staff, admin, and manager users can send messages.' }
  }

  const trimmed = messageText.trim()
  if (!trimmed && attachments.length === 0) {
    return { data: null, error: 'Please add a message or at least one attachment.' }
  }

  if (attachments.length > TEAM_TALK_MAX_ATTACHMENTS) {
    return {
      data: null,
      error: `You can upload up to ${TEAM_TALK_MAX_ATTACHMENTS} attachments at once.`,
    }
  }

  if (attachments.length > 0) {
    for (const attachment of attachments) {
      if (!TEAM_TALK_ALLOWED_MIME_TYPES.includes(attachment.mime_type as any)) {
        return {
          data: null,
          error: 'One or more attachments are not an allowed file type.',
        }
      }
      if (attachment.size_bytes > TEAM_TALK_MAX_ATTACHMENT_SIZE_BYTES) {
        return {
          data: null,
          error: 'One or more attachments exceed the 5 MB limit.',
        }
      }
    }
  }

  const supabase = await createClient()
  if (needsAssignment(currentUser.role)) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to send messages for this project.' }
    }
  }

  const { data, error } = await supabase
    .from('project_team_talk_messages')
    .insert({
      project_id: projectId,
      message_text: trimmed || '',
      created_by: currentUser.id,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating Team Talk message:', error)
    if (attachments.length > 0) {
      await deleteCloudinaryAssets(
        attachments.map((attachment) => ({
          publicId: attachment.cloudinary_public_id,
          resourceType: attachment.resource_type,
        }))
      )
    }
    return { data: null, error: error.message || 'Failed to send message.' }
  }

  if (attachments.length > 0) {
    const messageRow = data as { id: string; project_id: string }
    const { error: attachmentError } = await supabase
      .from('project_team_talk_attachments')
      .insert(
        attachments.map((attachment) => ({
          message_id: messageRow.id,
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
      console.error('Error saving Team Talk attachments:', attachmentError)
      await supabase.from('project_team_talk_messages').delete().eq('id', messageRow.id)
      await deleteCloudinaryAssets(
        attachments.map((attachment) => ({
          publicId: attachment.cloudinary_public_id,
          resourceType: attachment.resource_type,
        }))
      )
      return {
        data: null,
        error: attachmentError.message || 'Failed to attach files to message',
      }
    }
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')

  const messageRow = data as {
    id: string
    project_id: string
    message_text: string
    created_by: string
    created_at: string
    updated_at: string
  }

  return {
    data: {
      id: messageRow.id,
      project_id: messageRow.project_id,
      message_text: messageRow.message_text,
      created_by: messageRow.created_by,
      created_by_name: currentUser.fullName || currentUser.email,
      created_by_email: currentUser.email,
      created_at: messageRow.created_at,
      updated_at: messageRow.updated_at,
      attachments: [],
    },
    error: null,
  }
}

export async function updateProjectTeamTalkMessage(
  messageId: string,
  messageText: string
): Promise<ProjectTeamTalkActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update messages.' }
  }
  if (!isEligibleRole(currentUser.role)) {
    return { data: null, error: 'Only staff, admin, and manager users can update messages.' }
  }

  const trimmed = messageText.trim()

  const supabase = await createClient()
  const { data: existingMessage, error: fetchError } = await supabase
    .from('project_team_talk_messages')
    .select('project_id, created_by')
    .eq('id', messageId)
    .single()

  if (fetchError || !existingMessage) {
    return { data: null, error: 'Message not found.' }
  }

  const messageRow = existingMessage as { project_id: string; created_by: string }

  if (messageRow.created_by !== currentUser.id) {
    return { data: null, error: 'You can only edit your own messages.' }
  }

  if (needsAssignment(currentUser.role)) {
    const isAssigned = await isUserAssignedToProject(supabase, messageRow.project_id, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to update messages for this project.' }
    }
  }

  if (!trimmed) {
    const { count } = await supabase
      .from('project_team_talk_attachments')
      .select('*', { count: 'exact', head: true })
      .eq('message_id', messageId)
    if ((count ?? 0) === 0) {
      return { data: null, error: 'Please add message text or keep at least one attachment.' }
    }
  }

  const { data, error } = await supabase
    .from('project_team_talk_messages')
    .update({ message_text: trimmed || '' } as never)
    .eq('id', messageId)
    .select()
    .single()

  if (error || !data) {
    console.error('Error updating Team Talk message:', error)
    return { data: null, error: error?.message || 'Failed to update message.' }
  }

  const updated = data as {
    id: string
    project_id: string
    message_text: string
    created_by: string
    created_at: string
    updated_at: string
  }

  revalidatePath(`/dashboard/projects/${updated.project_id}`)
  revalidatePath('/dashboard/projects')

  return {
    data: {
      id: updated.id,
      project_id: updated.project_id,
      message_text: updated.message_text,
      created_by: updated.created_by,
      created_by_name: currentUser.fullName || currentUser.email,
      created_by_email: currentUser.email,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      attachments: [],
    },
    error: null,
  }
}

export async function deleteProjectTeamTalkMessage(
  messageId: string
): Promise<ProjectTeamTalkActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to delete messages.' }
  }
  if (!isEligibleRole(currentUser.role)) {
    return { data: null, error: 'Only staff, admin, and manager users can delete messages.' }
  }

  const supabase = await createClient()
  const { data: existingMessage, error: fetchError } = await supabase
    .from('project_team_talk_messages')
    .select('project_id, created_by')
    .eq('id', messageId)
    .single()

  if (fetchError || !existingMessage) {
    return { data: null, error: 'Message not found.' }
  }

  const messageRow = existingMessage as { project_id: string; created_by: string }

  if (messageRow.created_by !== currentUser.id) {
    return { data: null, error: 'You can only delete your own messages.' }
  }

  if (needsAssignment(currentUser.role)) {
    const isAssigned = await isUserAssignedToProject(supabase, messageRow.project_id, currentUser.id)
    if (!isAssigned) {
      return { data: null, error: 'You do not have permission to delete messages for this project.' }
    }
  }

  const { data: attachments } = await supabase
    .from('project_team_talk_attachments')
    .select('cloudinary_public_id, resource_type')
    .eq('message_id', messageId)

  const { data, error } = await supabase
    .from('project_team_talk_messages')
    .delete()
    .eq('id', messageId)
    .select()
    .single()

  if (error) {
    console.error('Error deleting Team Talk message:', error)
    return { data: null, error: error.message || 'Failed to delete message.' }
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

  revalidatePath(`/dashboard/projects/${messageRow.project_id}`)
  revalidatePath('/dashboard/projects')

  return {
    data: {
      ...(data as ProjectTeamTalkMessage),
      attachments: [],
    },
    error: null,
  }
}

export async function deleteProjectTeamTalkAttachment(
  attachmentId: string
): Promise<{ error: string | null; deletedMessageId?: string | null; messageId?: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'You must be logged in to delete attachments.' }
  }
  if (!isEligibleRole(currentUser.role)) {
    return { error: 'Only staff, admin, and manager users can delete attachments.' }
  }

  const supabase = await createClient()
  const { data: attachment, error: attachmentError } = await supabase
    .from('project_team_talk_attachments')
    .select('id, message_id, project_id, cloudinary_public_id, resource_type')
    .eq('id', attachmentId)
    .single()

  if (attachmentError || !attachment) {
    return { error: attachmentError?.message || 'Attachment not found.' }
  }

  const attachmentRow = attachment as {
    id: string
    message_id: string
    project_id: string
    cloudinary_public_id: string
    resource_type: string
  }

  const { data: message, error: messageError } = await supabase
    .from('project_team_talk_messages')
    .select('id, message_text, created_by')
    .eq('id', attachmentRow.message_id)
    .single()

  if (messageError || !message) {
    return { error: messageError?.message || 'Message not found.' }
  }

  const messageRow = message as { id: string; message_text: string; created_by: string }

  if (messageRow.created_by !== currentUser.id) {
    return { error: 'You can only delete attachments from your own messages.' }
  }

  if (needsAssignment(currentUser.role)) {
    const isAssigned = await isUserAssignedToProject(supabase, attachmentRow.project_id, currentUser.id)
    if (!isAssigned) {
      return { error: 'You do not have permission to delete attachments for this project.' }
    }
  }

  const { error: deleteError } = await supabase
    .from('project_team_talk_attachments')
    .delete()
    .eq('id', attachmentId)

  if (deleteError) {
    return { error: deleteError.message || 'Failed to delete attachment.' }
  }

  await deleteCloudinaryAssets([
    {
      publicId: attachmentRow.cloudinary_public_id,
      resourceType: attachmentRow.resource_type,
    },
  ])

  let deletedMessageId: string | null = null
  const messageText = messageRow.message_text?.trim() || ''
  if (!messageText) {
    const { count } = await supabase
      .from('project_team_talk_attachments')
      .select('*', { count: 'exact', head: true })
      .eq('message_id', messageRow.id)
    if ((count ?? 0) === 0) {
      const { error: deleteMessageError } = await supabase
        .from('project_team_talk_messages')
        .delete()
        .eq('id', messageRow.id)
      if (!deleteMessageError) {
        deletedMessageId = messageRow.id
      }
    }
  }

  revalidatePath(`/dashboard/projects/${attachmentRow.project_id}`)
  revalidatePath('/dashboard/projects')

  return {
    error: null,
    deletedMessageId,
    messageId: messageRow.id,
  }
}
