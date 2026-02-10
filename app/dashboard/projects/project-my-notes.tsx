'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import { EmptyState } from '@/app/components/empty-state'
import {
  PROJECT_NOTE_ALLOWED_EXTENSIONS,
  PROJECT_NOTE_EXTENSION_MIME_MAP,
  PROJECT_NOTE_MAX_ATTACHMENT_SIZE_BYTES,
  PROJECT_NOTE_MAX_ATTACHMENTS,
  getFileCategory,
} from '@/lib/projects/my-notes-constants'
import {
  createProjectMyNote,
  deleteProjectMyNote,
  deleteProjectNoteAttachment,
  getProjectMyNotes,
  getProjectMyNotesUploadSignature,
  updateProjectMyNote,
  type ProjectMyNote,
  type ProjectMyNoteAttachmentInput,
} from '@/lib/projects/my-notes-actions'

interface ProjectMyNotesProps {
  projectId: string
  userRole: string
  currentUserId: string | undefined
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

const maxSizeMB = PROJECT_NOTE_MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)

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

const urlRegex = /((https?:\/\/[^\s<]+)|((www\.)[^\s<]+))/gi

function renderNoteText(text: string, linkClassName: string) {
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

function isEdited(note: ProjectMyNote): boolean {
  const createdAt = new Date(note.created_at).getTime()
  const updatedAt = new Date(note.updated_at).getTime()
  return updatedAt - createdAt > 1000
}

function NoteDeleteModal({
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
          <h2 className="text-xl font-semibold text-[#1E1B4B]">Delete Note</h2>
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
                Are you sure you want to delete this note? This action cannot be undone.
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

export function ProjectMyNotes({
  projectId,
  userRole,
  currentUserId,
  className = '',
  hideHeader = false,
  isActiveTab = true,
}: ProjectMyNotesProps) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [notes, setNotes] = useState<ProjectMyNote[]>([])
  const canAccess = (userRole === 'staff' || userRole === 'admin' || userRole === 'manager') && Boolean(currentUserId)
  const [loading, setLoading] = useState(canAccess && isActiveTab)
  const [error, setError] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ total: number; done: number }>({
    total: 0,
    done: 0,
  })
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<ProjectMyNote | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteAttachmentModal, setDeleteAttachmentModal] = useState<{ isOpen: boolean; attachmentId: string | null; fileName: string }>({
    isOpen: false,
    attachmentId: null,
    fileName: '',
  })
  const [deletingAttachment, setDeletingAttachment] = useState(false)
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const objectUrlsRef = useRef<Map<number, string>>(new Map())
  const hasLoadedRef = useRef(false)
  const wasActiveTabRef = useRef(isActiveTab)

  const fetchNotes = async (options?: { silent?: boolean }) => {
    if (!canAccess) return
    const silent = options?.silent ?? false
    if (!silent) {
      setLoading(true)
      setError(null)
    }

    const result = await getProjectMyNotes(projectId)

    if (result.error) {
      if (!silent) {
        setError(result.error)
        setLoading(false)
      } else {
        showError('Refresh Failed', result.error)
      }
      return
    }

    setNotes(result.data ?? [])
    if (!silent) setLoading(false)
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
      fetchNotes()
      return
    }

    if (!wasActive) {
      fetchNotes({ silent: true })
    }
  }, [projectId, canAccess, isActiveTab])

  useEffect(() => {
    if (loading || error || notes.length === 0) return
    const el = scrollContainerRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [loading, error, notes.length])

  const clearObjectUrls = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current.clear()
  }

  useEffect(() => {
    return () => {
      clearObjectUrls()
    }
  }, [])

  const handleFilesSelected = (files: File[]) => {
    if (selectedFiles.length + files.length > PROJECT_NOTE_MAX_ATTACHMENTS) {
      showError(
        'Attachment Limit',
        `You can add up to ${PROJECT_NOTE_MAX_ATTACHMENTS} attachments at once.`
      )
      return
    }

    const combinedFiles = [...selectedFiles, ...files]

    for (const file of combinedFiles) {
      const extension = getFileExtension(file.name)
      if (!extension || !PROJECT_NOTE_ALLOWED_EXTENSIONS.includes(extension as any)) {
        showError('Invalid File Type', `"${file.name}" is not a supported file type.`)
        return
      }
    }

    const oversizeFile = combinedFiles.find(
      (file) => file.size > PROJECT_NOTE_MAX_ATTACHMENT_SIZE_BYTES
    )
    if (oversizeFile) {
      showError(
        'File Too Large',
        `"${oversizeFile.name}" exceeds ${maxSizeMB} MB limit.`
      )
      return
    }

    const firstFileCategory =
      selectedFiles.length > 0
        ? getFileCategory(getFileExtension(selectedFiles[0].name))
        : getFileCategory(getFileExtension(combinedFiles[0].name))

    if (!firstFileCategory) {
      showError('Invalid File Type', 'Unable to determine file category.')
      return
    }

    const allSameCategory = combinedFiles.every((file) => {
      const extension = getFileExtension(file.name)
      const category = getFileCategory(extension)
      return category === firstFileCategory
    })

    if (!allSameCategory) {
      const categoryName = firstFileCategory === 'image' ? 'images' : 'documents'
      showError(
        'Mixed File Categories',
        `You can only select ${categoryName} at a time. Please select all images together or all documents together.`
      )
      return
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

  const handleCreate = async () => {
    if (!canAccess) {
      showError('Read-only Access', 'Only staff, admin, and manager users can add notes.')
      return
    }
    const trimmed = noteText.trim()
    if (!trimmed && selectedFiles.length === 0) {
      showError('Note or attachment required', 'Please enter a note or add an attachment before saving.')
      return
    }

    setSubmitting(true)
    setUploadProgress({ total: selectedFiles.length, done: 0 })

    let attachments: ProjectMyNoteAttachmentInput[] = []

    if (selectedFiles.length > 0) {
      const signatureResult = await getProjectMyNotesUploadSignature(projectId)
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
            file.type || PROJECT_NOTE_EXTENSION_MIME_MAP[extension] || 'application/octet-stream'

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

    const result = await createProjectMyNote(projectId, trimmed, attachments)
    setSubmitting(false)

    if (!result.error && result.data) {
      setNotes((prev) => [...prev, result.data as ProjectMyNote])
      setNoteText('')
      setSelectedFiles([])
      clearObjectUrls()
      setUploadProgress({ total: 0, done: 0 })
      showSuccess('Note Added', 'Your private note has been saved.')
      await fetchNotes({ silent: true })
      router.refresh()
    } else {
      showError('Failed to add note', result.error || 'Unable to save note.')
    }
  }

  const handleStartEdit = (note: ProjectMyNote) => {
    setEditingNoteId(note.id)
    setEditingNoteText(note.note_text ?? '')
  }

  useEffect(() => {
    if (!editingNoteId) return
    editTextareaRef.current?.focus()
    const timer = setTimeout(() => {
      const el = editTextareaRef.current
      if (el) {
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [editingNoteId])

  const handleCancelEdit = () => {
    setEditingNoteId(null)
    setEditingNoteText('')
  }

  const handleSaveEdit = async (note?: ProjectMyNote) => {
    if (!editingNoteId) return
    const trimmed = editingNoteText.trim()
    const existingNote = note ?? notes.find((n) => n.id === editingNoteId)
    const hasAttachments = (existingNote?.attachments?.length ?? 0) > 0
    if (!trimmed && !hasAttachments) {
      showError('Note or attachment required', 'Please enter a note or add an attachment before saving.')
      return
    }

    setSavingEdit(true)
    const result = await updateProjectMyNote(editingNoteId, trimmed)
    setSavingEdit(false)

    if (!result.error && result.data) {
      setNotes((prev) =>
        prev.map((note) => (note.id === editingNoteId ? (result.data as ProjectMyNote) : note))
      )
      setEditingNoteId(null)
      setEditingNoteText('')
      showSuccess('Note Updated', 'Changes have been saved.')
      await fetchNotes({ silent: true })
      router.refresh()
    } else {
      showError('Update Failed', result.error || 'Unable to update note.')
    }
  }

  const handleDelete = (note: ProjectMyNote) => {
    setNoteToDelete(note)
    setDeleteModalOpen(true)
  }

  const handleCopyNote = async (note: ProjectMyNote) => {
    const text = note.note_text?.trim() || ''
    if (!text) {
      showError('Nothing to Copy', 'This note has no text to copy.')
      return
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      showSuccess('Copied', 'Note copied to clipboard.')
    } catch (error) {
      console.error('Clipboard copy failed:', error)
      showError('Copy Failed', 'Unable to copy note.')
    }
  }

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return
    setDeleting(true)
    const result = await deleteProjectMyNote(noteToDelete.id)
    setDeleting(false)

    if (!result.error) {
      setNotes((prev) => prev.filter((note) => note.id !== noteToDelete.id))
      setDeleteModalOpen(false)
      setNoteToDelete(null)
      showSuccess('Note Deleted', 'The note has been removed.')
      await fetchNotes({ silent: true })
      router.refresh()
    } else {
      showError('Delete Failed', result.error || 'Unable to delete note.')
    }
  }

  const handleDeleteAttachmentClick = (attachmentId: string, fileName: string) => {
    setDeleteAttachmentModal({
      isOpen: true,
      attachmentId,
      fileName,
    })
  }

  const handleDeleteAttachmentConfirm = async () => {
    if (!deleteAttachmentModal.attachmentId) return

    setDeletingAttachment(true)
    const result = await deleteProjectNoteAttachment(deleteAttachmentModal.attachmentId)
    setDeletingAttachment(false)

    if (result.error) {
      showError('Delete Failed', result.error)
      setDeleteAttachmentModal({ isOpen: false, attachmentId: null, fileName: '' })
      return
    }

    showSuccess('Attachment Deleted', 'The attachment was removed.')
    setDeleteAttachmentModal({ isOpen: false, attachmentId: null, fileName: '' })
    await fetchNotes({ silent: true })
  }

  const handleDeleteAttachmentCancel = () => {
    setDeleteAttachmentModal({ isOpen: false, attachmentId: null, fileName: '' })
  }

  const header = hideHeader ? null : (
    <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white/80 rounded-t-2xl">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#0891b2] flex items-center justify-center shadow-lg shadow-cyan-200/50">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M8 11h8M8 15h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
          </svg>
        </div>
        <div>
          <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold text-[#0C4A6E] tracking-tight">My Notes</h4>
          <p className="text-xs text-slate-500">Private to you in this project</p>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1">
        Private
      </span>
    </div>
  )

  if (!canAccess) {
    return (
      <div className={`h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
        {header}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <p className="text-sm font-semibold text-slate-600">My Notes are available to staff, admin, and manager users only.</p>
            <p className="text-xs text-slate-500 mt-2">Notes are private and only visible to the logged-in user.</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading && notes.length === 0) {
    return (
      <div className={`h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
        {header}
        <div className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-hide" aria-busy="true" aria-label="Loading notes">
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="h-2.5 w-20 rounded bg-slate-200 animate-pulse" />
                  <span className="h-2.5 w-12 rounded bg-slate-200 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <span className="block h-2.5 w-full rounded bg-slate-200 animate-pulse" />
                  <span className="block h-2.5 w-5/6 rounded bg-slate-200 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-slate-100 px-2.5 py-2">
          <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          <div className="mt-2 h-8 w-full sm:w-28 rounded-lg bg-slate-200 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
        {header}
        <div className="p-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
        {header}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1.5 scrollbar-hide">
          {notes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="w-full max-w-[300px]">
                <EmptyState
                  variant="default"
                  title="No notes yet"
                  description="Add a private note for yourself about this project."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {notes.map((note) => {
                const edited = isEdited(note)
                const timestamp = edited ? note.updated_at : note.created_at
                return (
                  <div key={note.id} className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Tooltip content={formatDateTime(timestamp)}>
                          <span className="text-[11px] font-semibold text-slate-500 shrink-0">{getRelativeTime(timestamp)}</span>
                        </Tooltip>
                        {edited && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-full px-1.5 py-0.5 shrink-0">
                            Edited
                          </span>
                        )}
                      </div>
                      {editingNoteId !== note.id && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Tooltip content="Copy note">
                            <button
                              type="button"
                              onClick={() => handleCopyNote(note)}
                              className="rounded p-1 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors cursor-pointer"
                              aria-label="Copy note"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16h8m-8-4h8m-8-4h6M6 20h12a2 2 0 002-2V8l-6-6H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                            </button>
                          </Tooltip>
                          <Tooltip content="Edit note">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(note)}
                              className="rounded p-1 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors cursor-pointer"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </Tooltip>
                          <Tooltip content="Delete note">
                            <button
                              type="button"
                              onClick={() => handleDelete(note)}
                              className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </Tooltip>
                        </div>
                      )}
                    </div>

                    {editingNoteId === note.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          ref={editTextareaRef}
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              handleCancelEdit()
                            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault()
                              handleSaveEdit(note)
                            }
                          }}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 resize-none"
                          aria-label="Edit note"
                        />
                        <div className="flex flex-col sm:flex-row gap-1.5 sm:justify-end">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(note)}
                            disabled={savingEdit}
                            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 cursor-pointer"
                          >
                            {savingEdit ? 'Saving...' : 'Save changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {note.note_text.trim() ? (
                          <p className="mt-1.5 text-sm font-normal text-slate-700 whitespace-pre-wrap break-words leading-snug">
                            {renderNoteText(note.note_text, 'underline text-cyan-700 hover:text-cyan-800')}
                          </p>
                        ) : null}
                      </>
                    )}

                    {note.attachments.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                          Attachments
                        </p>
                        <div className="space-y-1">
                          {note.attachments.map((attachment) => {
                            const isImage = attachment.mime_type.startsWith('image/')
                            return (
                              <div
                                key={attachment.id}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 hover:border-cyan-200 hover:bg-cyan-50 transition-colors"
                              >
                                <a
                                  href={attachment.cloudinary_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 flex-1 min-w-0"
                                >
                                  <div className="flex h-8 w-8 items-center justify-center rounded bg-white text-slate-400 flex-shrink-0">
                                    {isImage ? (
                                      <img
                                        src={attachment.cloudinary_url}
                                        alt={attachment.file_name}
                                        className="h-8 w-8 rounded object-cover"
                                      />
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-6-8h6M7 20h10a2 2 0 002-2V8l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-700">{attachment.file_name}</p>
                                    <p className="text-[10px] text-slate-400">{formatFileSize(attachment.size_bytes)}</p>
                                  </div>
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteAttachmentClick(attachment.id, attachment.file_name)
                                  }}
                                  className="flex-shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
                                  aria-label="Delete attachment"
                                  title="Delete attachment"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-white/60 px-2.5 py-2 flex flex-col min-h-0 flex-shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
            <label
              htmlFor="project-my-note"
              className="text-[11px] font-semibold uppercase tracking-wider text-slate-400"
            >
              Add a private note
            </label>
            <div className="flex items-center gap-1 text-[9px] text-slate-500">
              <span>Max {PROJECT_NOTE_MAX_ATTACHMENTS}</span>
              <span>|</span>
              <span>{maxSizeMB}MB</span>
              <span>|</span>
              <span>Same category</span>
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mb-1.5 overflow-x-auto scrollbar-hide overflow-y-visible pt-1 flex-shrink-0">
              <div className="flex gap-2 pb-1">
                {selectedFiles.map((file, index) => {
                  const isImage = file.type.startsWith('image/')
                  if (isImage && !objectUrlsRef.current.has(index)) {
                    const url = URL.createObjectURL(file)
                    objectUrlsRef.current.set(index, url)
                  }
                  const objectUrl = isImage ? objectUrlsRef.current.get(index) : null

                  return (
                    <div key={`${file.name}-${index}`} className="relative flex-shrink-0 group" style={{ paddingTop: '6px' }}>
                      <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
                        {isImage && objectUrl ? (
                          <img
                            src={objectUrl}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className="absolute top-0 right-0 rounded-full bg-rose-500 text-white p-0.5 opacity-100 transition-all duration-200 shadow-md hover:bg-rose-600 hover:scale-110 z-50 border border-white"
                        style={{ transform: 'translate(30%, -30%)' }}
                        aria-label="Remove file"
                        title="Remove file"
                      >
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-[8px] px-1 py-1 truncate">
                        {file.name}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex gap-1.5 flex-1 min-h-0">
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              <textarea
                id="project-my-note"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write a quick reminder or personal note..."
                className="w-full flex-1 min-h-[72px] max-h-[140px] rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/10 resize-none"
              />
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-50 min-w-[64px] cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828a4 4 0 00-5.656-5.656L6.343 10.172a6 6 0 108.486 8.486L20 13" />
                </svg>
                <span className="text-[9px]">Attachment</span>
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="btn-gradient-smooth flex flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-2 text-white shadow-sm transition-colors hover:opacity-90 disabled:opacity-50 min-w-[64px] cursor-pointer"
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-[11px] font-semibold">Saving...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-[11px] font-semibold">Save</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={PROJECT_NOTE_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',') + ',image/*'}
            onChange={handleFileInputChange}
            className="hidden"
          />

          {submitting && uploadProgress.total > 0 && (
            <div className="mt-1 text-center">
              <p className="text-[9px] text-slate-500">
                Uploading {uploadProgress.done}/{uploadProgress.total} files...
              </p>
            </div>
          )}
        </div>
      </div>

      <NoteDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setNoteToDelete(null)
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
