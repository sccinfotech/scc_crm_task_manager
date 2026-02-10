'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import { EmptyState } from '@/app/components/empty-state'
import type { ProjectTeamMember } from '@/lib/projects/actions'
import {
  TEAM_TALK_ALLOWED_EXTENSIONS,
  TEAM_TALK_ALLOWED_MIME_TYPES,
  TEAM_TALK_EXTENSION_MIME_MAP,
  TEAM_TALK_MAX_ATTACHMENT_SIZE_BYTES,
  TEAM_TALK_MAX_ATTACHMENTS,
} from '@/lib/projects/team-talk-constants'
import {
  createProjectTeamTalkMessage,
  deleteProjectTeamTalkAttachment,
  deleteProjectTeamTalkMessage,
  getProjectTeamTalkMessages,
  getProjectTeamTalkUploadSignature,
  updateProjectTeamTalkMessage,
  type ProjectTeamTalkMessage,
  type ProjectTeamTalkAttachmentInput,
} from '@/lib/projects/team-talk-actions'

interface ProjectTeamTalkProps {
  projectId: string
  userRole: string
  currentUserId: string | undefined
  teamMembers?: ProjectTeamMember[] | null
  className?: string
  hideHeader?: boolean
  isActiveTab?: boolean
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString)
  return (
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' - ' +
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  )
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`

  return formatDateTime(dateString)
}

function getInitials(name?: string | null, fallback?: string | null) {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  if (fallback) return fallback.slice(0, 2).toUpperCase()
  return '??'
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileExtension(name: string) {
  const parts = name.split('.')
  if (parts.length < 2) return ''
  return parts[parts.length - 1].toLowerCase()
}

const maxSizeMB = TEAM_TALK_MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)
const acceptedExtensions = TEAM_TALK_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')
const urlRegex = /((https?:\/\/[^\s<]+)|((www\.)[^\s<]+))/gi

function isEdited(message: ProjectTeamTalkMessage): boolean {
  const createdAt = new Date(message.created_at).getTime()
  const updatedAt = new Date(message.updated_at).getTime()
  return updatedAt - createdAt > 1000
}

function renderMessageText(text: string, linkClassName: string) {
  if (!text) return null
  const parts: Array<string | ReactElement> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  urlRegex.lastIndex = 0

  while ((match = urlRegex.exec(text)) !== null) {
    const start = match.index
    const urlText = match[0]
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start))
    }
    const href = urlText.startsWith('http') ? urlText : `https://${urlText}`
    parts.push(
      <a
        key={`${start}-${urlText}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        className={linkClassName}
      >
        {urlText}
      </a>
    )
    lastIndex = start + urlText.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.map((part, index) =>
    typeof part === 'string' ? <span key={`text-${index}`}>{part}</span> : part
  )
}

function MessageDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1E1B4B]">Delete Message</h2>
        </div>
        <div className="px-6 py-6">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this message? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AttachmentDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  fileName,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  fileName: string
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1E1B4B]">Delete Attachment</h2>
        </div>
        <div className="px-6 py-6">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete the attachment{' '}
                <span className="font-semibold text-[#1E1B4B]">{fileName}</span>? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProjectTeamTalk({
  projectId,
  userRole,
  currentUserId,
  teamMembers,
  className = '',
  hideHeader = false,
  isActiveTab = true,
}: ProjectTeamTalkProps) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const objectUrlsRef = useRef<Map<number, string>>(new Map())

  const isAssigned = Boolean(currentUserId && teamMembers?.some((member) => member.id === currentUserId))
  const canAccess = Boolean(
    currentUserId && (userRole === 'admin' || userRole === 'manager' || (userRole === 'staff' && isAssigned))
  )

  const [messages, setMessages] = useState<ProjectTeamTalkMessage[]>([])
  const [loading, setLoading] = useState(canAccess && isActiveTab)
  const [error, setError] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ total: number; done: number }>({
    total: 0,
    done: 0,
  })
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageText, setEditingMessageText] = useState('')
  const [editingCardWidth, setEditingCardWidth] = useState<number | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [messageToDelete, setMessageToDelete] = useState<ProjectTeamTalkMessage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteAttachmentModal, setDeleteAttachmentModal] = useState<{
    isOpen: boolean
    attachmentId: string | null
    messageId: string | null
    fileName: string
  }>({
    isOpen: false,
    attachmentId: null,
    messageId: null,
    fileName: '',
  })
  const [deletingAttachment, setDeletingAttachment] = useState(false)
  const hasLoadedRef = useRef(false)
  const wasActiveTabRef = useRef(isActiveTab)

  const clearObjectUrls = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current.clear()
  }

  useEffect(() => {
    return () => {
      clearObjectUrls()
    }
  }, [])

  const fetchMessages = async (options?: { silent?: boolean }) => {
    if (!canAccess) return
    const silent = options?.silent ?? false
    if (!silent) {
      setLoading(true)
      setError(null)
    }

    const result = await getProjectTeamTalkMessages(projectId)

    if (result.error) {
      if (!silent) {
        setError(result.error)
        setLoading(false)
      } else {
        showError('Refresh Failed', result.error)
      }
      return
    }

    if (result.data) {
      setMessages(result.data)
    }

    setLoading(false)
  }

  useEffect(() => {
    hasLoadedRef.current = false
  }, [projectId])

  useEffect(() => {
    if (!canAccess) {
      setLoading(false)
      return
    }

    const wasActive = wasActiveTabRef.current
    wasActiveTabRef.current = isActiveTab
    if (!isActiveTab) return

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      fetchMessages()
      return
    }

    if (!wasActive) {
      fetchMessages({ silent: true })
    }
  }, [projectId, canAccess, isActiveTab])

  useEffect(() => {
    if (loading || error) return
    const el = scrollContainerRef.current
    if (!el) return

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [loading, error, messages.length])

  const handleFilesSelected = (files: File[]) => {
    const combinedFiles = [...selectedFiles, ...files]
    if (combinedFiles.length > TEAM_TALK_MAX_ATTACHMENTS) {
      showError('Too Many Files', `You can upload up to ${TEAM_TALK_MAX_ATTACHMENTS} attachments at once.`)
      return
    }

    for (const file of files) {
      const extension = getFileExtension(file.name)
      const mimeType = file.type || TEAM_TALK_EXTENSION_MIME_MAP[extension] || ''
      const allowedByExtension = TEAM_TALK_ALLOWED_EXTENSIONS.includes(extension as any)
      const allowedByMime = mimeType ? TEAM_TALK_ALLOWED_MIME_TYPES.includes(mimeType as any) : false

      if (!allowedByExtension && !allowedByMime) {
        showError('Unsupported File', `${file.name} is not an allowed file type.`)
        return
      }

      if (file.size > TEAM_TALK_MAX_ATTACHMENT_SIZE_BYTES) {
        showError('File Too Large', `${file.name} exceeds the ${maxSizeMB}MB limit.`)
        return
      }
    }

    setSelectedFiles(combinedFiles)
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    handleFilesSelected(files)
    event.target.value = ''
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => {
      clearObjectUrls()
      return prev.filter((_, fileIndex) => fileIndex !== index)
    })
  }

  const handleSend = async () => {
    if (!canAccess) {
      showError('Read-only Access', 'Only team members, admins, and managers can send messages.')
      return
    }

    const trimmed = messageText.trim()
    if (!trimmed && selectedFiles.length === 0) {
      showError('Message Required', 'Add a message or attachment before sending.')
      return
    }

    setSubmitting(true)
    const attachments: ProjectTeamTalkAttachmentInput[] = []

    if (selectedFiles.length > 0) {
      const signatureResult = await getProjectTeamTalkUploadSignature(projectId)
      if (signatureResult.error || !signatureResult.data) {
        setSubmitting(false)
        showError('Upload Failed', signatureResult.error || 'Failed to prepare upload.')
        return
      }

      const signature = signatureResult.data

      try {
        for (let i = 0; i < selectedFiles.length; i += 1) {
          const file = selectedFiles[i]
          const extension = getFileExtension(file.name)
          const mimeType =
            file.type || TEAM_TALK_EXTENSION_MIME_MAP[extension] || 'application/octet-stream'

          const formData = new FormData()
          formData.append('file', file)
          formData.append('api_key', signature.apiKey)
          formData.append('timestamp', String(signature.timestamp))
          formData.append('signature', signature.signature)
          formData.append('folder', signature.folder)

          const response = await fetch(
            `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`,
            {
              method: 'POST',
              body: formData,
            }
          )

          if (!response.ok) {
            throw new Error('Upload failed')
          }

          const data = await response.json()

          attachments.push({
            file_name: file.name,
            mime_type: mimeType,
            size_bytes: data.bytes || file.size,
            cloudinary_url: data.secure_url,
            cloudinary_public_id: data.public_id,
            resource_type: data.resource_type || (mimeType.startsWith('image/') ? 'image' : 'raw'),
          })

          setUploadProgress({ total: selectedFiles.length, done: i + 1 })
        }
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError)
        setSubmitting(false)
        showError('Upload Failed', 'Could not upload one or more files.')
        return
      }
    }

    const result = await createProjectTeamTalkMessage(projectId, trimmed, attachments)
    setSubmitting(false)

    if (!result.error && result.data) {
      setMessages((prev) => [...prev, result.data as ProjectTeamTalkMessage])
      setMessageText('')
      setSelectedFiles([])
      clearObjectUrls()
      setUploadProgress({ total: 0, done: 0 })
      showSuccess('Message Sent', 'Your update has been posted to the team.')
      await fetchMessages({ silent: true })
      router.refresh()
    } else {
      showError('Send Failed', result.error || 'Unable to send message.')
    }
  }

  const handleStartEdit = (message: ProjectTeamTalkMessage) => {
    const cardEl = document.querySelector(`[data-message-card="${message.id}"]`) as HTMLElement | null
    const w = cardEl ? cardEl.offsetWidth : null
    setEditingCardWidth(w ?? null)
    setEditingMessageId(message.id)
    setEditingMessageText(message.message_text ?? '')
  }

  useEffect(() => {
    if (!editingMessageId) return
    editTextareaRef.current?.focus()
    const timer = setTimeout(() => {
      const el = editTextareaRef.current
      if (el) {
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [editingMessageId])

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingMessageText('')
    setEditingCardWidth(null)
  }

  const handleSaveEdit = async (message: ProjectTeamTalkMessage) => {
    const trimmed = editingMessageText.trim()
    const hasAttachments = (message.attachments?.length ?? 0) > 0
    if (!trimmed && !hasAttachments) {
      showError('Message or attachment required', 'Please enter a message or keep at least one attachment.')
      return
    }

    setSavingEdit(true)
    const result = await updateProjectTeamTalkMessage(message.id, trimmed)
    setSavingEdit(false)

    if (!result.error && result.data) {
      setMessages((prev) =>
        prev.map((item) => (item.id === message.id ? { ...item, message_text: trimmed || '', updated_at: result.data!.updated_at } : item))
      )
      setEditingMessageId(null)
      setEditingMessageText('')
      setEditingCardWidth(null)
      showSuccess('Message Updated', 'Changes have been saved.')
      await fetchMessages({ silent: true })
      router.refresh()
    } else {
      showError('Update Failed', result.error || 'Unable to update message.')
    }
  }

  const handleDelete = (message: ProjectTeamTalkMessage) => {
    setMessageToDelete(message)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!messageToDelete) return
    setDeleting(true)
    const result = await deleteProjectTeamTalkMessage(messageToDelete.id)
    setDeleting(false)

    if (!result.error) {
      setMessages((prev) => prev.filter((message) => message.id !== messageToDelete.id))
      setDeleteModalOpen(false)
      setMessageToDelete(null)
      showSuccess('Message Deleted', 'The message has been removed.')
      await fetchMessages({ silent: true })
      router.refresh()
    } else {
      showError('Delete Failed', result.error || 'Unable to delete message.')
    }
  }

  const handleDeleteAttachmentClick = (attachmentId: string, messageId: string, fileName: string) => {
    setDeleteAttachmentModal({
      isOpen: true,
      attachmentId,
      messageId,
      fileName,
    })
  }

  const handleDeleteAttachmentConfirm = async () => {
    if (!deleteAttachmentModal.attachmentId || !deleteAttachmentModal.messageId) return
    setDeletingAttachment(true)
    const result = await deleteProjectTeamTalkAttachment(deleteAttachmentModal.attachmentId)
    setDeletingAttachment(false)

    if (result.error) {
      showError('Delete Failed', result.error)
      setDeleteAttachmentModal({ isOpen: false, attachmentId: null, messageId: null, fileName: '' })
      return
    }

    const deletedMessageId = result.deletedMessageId || null
    if (deletedMessageId) {
      setMessages((prev) => prev.filter((message) => message.id !== deletedMessageId))
      if (editingMessageId === deletedMessageId) {
        setEditingMessageId(null)
        setEditingMessageText('')
      }
    } else {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === deleteAttachmentModal.messageId
            ? {
                ...message,
                attachments: (message.attachments || []).filter(
                  (attachment) => attachment.id !== deleteAttachmentModal.attachmentId
                ),
              }
            : message
        )
      )
    }

    setDeleteAttachmentModal({ isOpen: false, attachmentId: null, messageId: null, fileName: '' })
    showSuccess('Attachment Deleted', 'The attachment was removed.')
    await fetchMessages({ silent: true })
    router.refresh()
  }

  const handleDeleteAttachmentCancel = () => {
    setDeleteAttachmentModal({ isOpen: false, attachmentId: null, messageId: null, fileName: '' })
  }

  const handleCopy = async (message: ProjectTeamTalkMessage) => {
    const text = message.message_text?.trim() || ''
    const attachmentLinks = (message.attachments || []).map((attachment) => attachment.cloudinary_url)
    const copyText = [text, ...attachmentLinks].filter(Boolean).join('\n')

    if (!copyText) {
      showError('Nothing to Copy', 'This message has no text or attachments to copy.')
      return
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = copyText
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      showSuccess('Copied', 'Message copied to clipboard.')
    } catch (error) {
      console.error('Clipboard copy failed:', error)
      showError('Copy Failed', 'Unable to copy message.')
    }
  }

  const header = hideHeader ? null : (
    <header
      className="flex items-center justify-between gap-4 p-4 sm:p-5 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm rounded-t-2xl transition-colors duration-200"
      aria-label="Team Talk section"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-10 w-10 flex-shrink-0 rounded-xl bg-slate-700 flex items-center justify-center shadow-sm ring-1 ring-slate-200/80"
          aria-hidden
        >
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg sm:text-xl font-bold text-slate-800 tracking-tight truncate">
            Team Talk
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Shared updates for the project team</p>
        </div>
      </div>
      <span
        className="flex-shrink-0 text-[10px] font-medium uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1"
        aria-label="Channel type: shared"
      >
        Shared
      </span>
    </header>
  )

  if (!canAccess) {
    return (
      <section
        className={`h-full flex flex-col bg-slate-50/80 rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
        aria-label="Team Talk"
      >
        {header}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <p className="text-sm font-medium text-slate-700">Team Talk is available to project team members, admins, and managers.</p>
            <p className="text-xs text-slate-500 mt-2">Join the team to share updates and attachments here.</p>
          </div>
        </div>
      </section>
    )
  }

  if (loading && messages.length === 0) {
    return (
      <section
        className={`h-full flex flex-col bg-slate-50/80 rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
        aria-label="Team Talk"
        aria-busy="true"
      >
        {header}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-3 w-1/3 rounded bg-slate-200 animate-pulse" />
                <div className="h-4 w-4/5 rounded bg-slate-200 animate-pulse" />
                <div className="h-4 w-3/5 rounded bg-slate-200 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 bg-white/80 px-4 py-3">
          <div className="h-[72px] rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section
        className={`h-full flex flex-col bg-slate-50/80 rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
        aria-label="Team Talk"
        aria-live="polite"
      >
        {header}
        <div className="p-4 sm:p-5">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-normal text-red-800" role="alert">
            {error}
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <section
        className={`h-full flex flex-col bg-slate-50/80 rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
        aria-label="Team Talk"
      >
        {header}
        <div
          ref={scrollContainerRef}
          role="feed"
          aria-label="Message list"
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5 py-5 space-y-5 min-h-0"
        >
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center">
              <div className="w-full max-w-[320px]">
                <EmptyState
                  variant="default"
                  title="No messages yet"
                  description="Start the conversation with a project update or attachment."
                />
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.created_by === currentUserId
              const initials = getInitials(message.created_by_name, message.created_by_email)
              const timestamp = message.created_at
              const edited = isEdited(message)
              const hasText = message.message_text.trim().length > 0
              const attachments = message.attachments || []
              const imageAttachments = attachments.filter((attachment) => attachment.mime_type.startsWith('image/'))
              const fileAttachments = attachments.filter((attachment) => !attachment.mime_type.startsWith('image/'))
              const canManageMessage = isMine

              return (
                <article
                  key={message.id}
                  className={`flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}
                  aria-label={`Message from ${isMine ? 'you' : message.created_by_name}, ${getRelativeTime(timestamp)}`}
                >
                  <div
                    className={`flex items-center gap-2 flex-wrap max-w-full ${isMine ? 'flex-row-reverse' : ''}`}
                    role="toolbar"
                    aria-label="Message actions"
                  >
                    <div
                      className="h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-medium bg-slate-200 text-slate-700 ring-1 ring-slate-200/80"
                      aria-hidden
                    >
                      {initials}
                    </div>
                    <Tooltip content={formatDateTime(timestamp)}>
                      <time dateTime={timestamp} className="text-[11px] text-slate-500">
                        {getRelativeTime(timestamp)}
                      </time>
                    </Tooltip>
                    <span className="text-xs font-medium text-slate-700">
                      {isMine ? 'You' : message.created_by_name}
                    </span>
                    {edited && (
                      <span className="text-[9px] font-medium uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-1.5 py-0.5">
                        Edited
                      </span>
                    )}
                    <Tooltip content="Copy message">
                      <button
                        type="button"
                        onClick={() => handleCopy(message)}
                        className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
                        aria-label="Copy message"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8m-8-4h8m-8-4h6M6 20h12a2 2 0 002-2V8l-6-6H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </Tooltip>
                    {canManageMessage && (
                      <>
                        <Tooltip content="Edit message">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(message)}
                            className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
                            aria-label="Edit message"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </Tooltip>
                        <Tooltip content="Delete message">
                          <button
                            type="button"
                            onClick={() => handleDelete(message)}
                            className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
                            aria-label="Delete message"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </Tooltip>
                      </>
                    )}
                  </div>
                  <div
                    data-message-card={message.id}
                    className={`min-w-[14rem] w-fit max-w-[85%] rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] transition-colors duration-200 ${
                      isMine ? 'border-l-2 border-l-slate-300' : 'border-l-2 border-l-slate-200'
                    }`}
                    style={
                      editingMessageId === message.id && editingCardWidth != null
                        ? { width: `${editingCardWidth}px`, minWidth: `${editingCardWidth}px` }
                        : undefined
                    }
                  >
                    {editingMessageId === message.id ? (
                      <div className="space-y-2 w-full min-w-0">
                        <textarea
                          ref={editTextareaRef}
                          value={editingMessageText}
                          onChange={(e) => setEditingMessageText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              handleCancelEdit()
                            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault()
                              handleSaveEdit(message)
                            }
                          }}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 resize-none"
                          aria-label="Edit message"
                        />
                        <div className="flex flex-col sm:flex-row gap-1.5 sm:justify-end">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(message)}
                            disabled={savingEdit}
                            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1"
                          >
                            {savingEdit ? 'Saving...' : 'Save changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      hasText && (
                        <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                          {renderMessageText(
                            message.message_text,
                            'underline text-slate-600 hover:text-slate-900'
                          )}
                        </p>
                      )
                    )}
                    {imageAttachments.length > 0 && (
                      <div className={`grid grid-cols-2 gap-2 ${hasText ? 'mt-2' : 'mt-0'}`}>
                        {imageAttachments.map((attachment) => (
                          <div key={attachment.id} className="relative">
                            <a
                              href={attachment.cloudinary_url}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-lg border border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
                            >
                              <img
                                src={attachment.cloudinary_url}
                                alt={attachment.file_name}
                                className="h-24 w-full object-cover"
                              />
                            </a>
                            {canManageMessage && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleDeleteAttachmentClick(attachment.id, message.id, attachment.file_name)
                                }}
                                className="absolute right-1 top-1 rounded-full bg-rose-500 p-1 text-white shadow-sm hover:bg-rose-600"
                                aria-label="Delete attachment"
                                title="Delete attachment"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {fileAttachments.length > 0 && (
                      <div className={`space-y-1.5 ${hasText || imageAttachments.length > 0 ? 'mt-2' : 'mt-0'}`}>
                        {fileAttachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
                          >
                            <a
                              href={attachment.cloudinary_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 flex-1 min-w-0"
                            >
                              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-slate-200 text-slate-600" aria-hidden>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-6-8h6M7 20h10a2 2 0 002-2V8l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-slate-700">{attachment.file_name}</p>
                                <p className="text-[10px] font-normal text-slate-500">{formatFileSize(attachment.size_bytes)}</p>
                              </div>
                            </a>
                            {canManageMessage && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteAttachmentClick(attachment.id, message.id, attachment.file_name)
                                }}
                                className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                aria-label="Delete attachment"
                                title="Delete attachment"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white/90 backdrop-blur-sm px-4 sm:px-5 py-3 flex flex-col min-h-0 flex-shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label htmlFor="project-team-talk-message" className="text-xs font-medium text-slate-600">
              New message
            </label>
            <p id="team-talk-limits" className="text-[11px] text-slate-500">
              Up to {TEAM_TALK_MAX_ATTACHMENTS} files · max {maxSizeMB}MB each
            </p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mb-2 overflow-x-auto overflow-y-visible flex-shrink-0">
              <div className="flex gap-2 pb-1">
                {selectedFiles.map((file, index) => {
                  const isImage = file.type.startsWith('image/')
                  if (isImage && !objectUrlsRef.current.has(index)) {
                    const url = URL.createObjectURL(file)
                    objectUrlsRef.current.set(index, url)
                  }
                  const objectUrl = isImage ? objectUrlsRef.current.get(index) : null

                  return (
                    <div key={`${file.name}-${index}`} className="relative flex-shrink-0" style={{ paddingTop: '6px' }}>
                      <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
                        {isImage && objectUrl ? (
                          <img src={objectUrl} alt={file.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-6-8h6M7 20h10a2 2 0 002-2V8l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveFile(index)
                        }}
                        className="absolute top-0 right-0 rounded-full bg-rose-500 text-white p-0.5 shadow-md hover:bg-rose-600 transition-colors duration-200 z-10 border-2 border-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 cursor-pointer"
                        style={{ transform: 'translate(30%, -30%)' }}
                        aria-label={`Remove ${file.name}`}
                      >
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-[9px] px-1.5 py-1 truncate rounded-b-xl">
                        {file.name}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-1 min-h-0">
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              <textarea
                id="project-team-talk-message"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Share an update or drop a note for the team..."
                className="w-full flex-1 min-h-[76px] max-h-[140px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 shadow-sm transition-colors duration-200 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                aria-describedby="team-talk-limits"
              />
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed min-w-[72px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
                aria-label="Add attachment"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828a4 4 0 00-5.656-5.656L6.343 10.172a6 6 0 108.486 8.486L20 13" />
                </svg>
                <span className="text-[10px] font-medium">Attach</span>
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={submitting}
                className="flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-800 px-3 py-2.5 text-white shadow-sm transition-colors duration-200 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed min-w-[72px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1"
                aria-label={submitting ? 'Sending message' : 'Send message'}
              >
                {submitting ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span className="text-[10px] font-semibold">Sending...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span className="text-[10px] font-semibold">Send</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {submitting && uploadProgress.total > 0 && (
            <p className="mt-2 text-center text-xs text-slate-500" role="status" aria-live="polite">
              Uploading {uploadProgress.done} of {uploadProgress.total} files…
            </p>
          )}
        </footer>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={acceptedExtensions}
          onChange={handleFileInputChange}
        />
      </section>

      <MessageDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setMessageToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        isLoading={deleting}
      />

      <AttachmentDeleteModal
        isOpen={deleteAttachmentModal.isOpen}
        onClose={handleDeleteAttachmentCancel}
        onConfirm={handleDeleteAttachmentConfirm}
        isLoading={deletingAttachment}
        fileName={deleteAttachmentModal.fileName}
      />
    </>
  )
}
