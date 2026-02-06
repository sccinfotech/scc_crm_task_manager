'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import {
  INTERNAL_NOTE_ALLOWED_EXTENSIONS,
  INTERNAL_NOTE_EXTENSION_MIME_MAP,
  INTERNAL_NOTE_MAX_ATTACHMENT_SIZE_BYTES,
  INTERNAL_NOTE_MAX_ATTACHMENTS,
  getFileCategory,
} from '@/lib/clients/internal-notes-constants'
import {
  ClientInternalNote,
  ClientInternalNoteAttachmentInput,
  createClientInternalNote,
  deleteClientInternalNote,
  deleteClientNoteAttachment,
  updateClientInternalNote,
  getClientInternalNotes,
  getCloudinaryUploadSignature,
} from '@/lib/clients/internal-notes-actions'

interface InternalNotesPanelProps {
  clientId: string | null
  clientName?: string
  isOpen: boolean
  onClose: () => void
}

const maxSizeMB = INTERNAL_NOTE_MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' • ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function getFileExtension(name: string) {
  const parts = name.split('.')
  if (parts.length < 2) return ''
  return parts[parts.length - 1].toLowerCase()
}

export function InternalNotesPanel({
  clientId,
  clientName,
  isOpen,
  onClose,
}: InternalNotesPanelProps) {
  const { success: showSuccess, error: showError } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const notesListRef = useRef<HTMLDivElement | null>(null)
  const [notes, setNotes] = useState<ClientInternalNote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ total: number; done: number }>({
    total: 0,
    done: 0,
  })
  const [isMounted, setIsMounted] = useState(false)
  const [isSilentRefresh, setIsSilentRefresh] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteAttachmentModal, setDeleteAttachmentModal] = useState<{ isOpen: boolean; attachmentId: string | null; fileName: string }>({
    isOpen: false,
    attachmentId: null,
    fileName: '',
  })
  const [deleteNoteModal, setDeleteNoteModal] = useState<{ isOpen: boolean; noteId: string | null }>({
    isOpen: false,
    noteId: null,
  })
  const [deletingAttachment, setDeletingAttachment] = useState(false)
  const [deletingNote, setDeletingNote] = useState(false)
  const objectUrlsRef = useRef<Map<number, string>>(new Map())

  const selectedExtension = useMemo(() => {
    if (selectedFiles.length === 0) return ''
    return getFileExtension(selectedFiles[0].name)
  }, [selectedFiles])

  useEffect(() => {
    if (!isOpen || !clientId) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, clientId, onClose])

  const fetchNotes = async (silent = false) => {
    if (!clientId) return
    if (!silent) {
      setLoading(true)
    }
    setIsSilentRefresh(silent)
    setError(null)
    const result = await getClientInternalNotes(clientId)
    if (!silent) {
      setLoading(false)
    }
    setIsSilentRefresh(false)
    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setNotes(result.data)
      // Auto-scroll to bottom after notes are loaded
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
  }

  const scrollToBottom = () => {
    if (notesListRef.current) {
      notesListRef.current.scrollTo({
        top: notesListRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setIsMounted(false)
      return
    }
    // Start with panel off-screen, then slide in
    setIsMounted(false)
    void fetchNotes()
    // Trigger slide-in animation after DOM is ready
    requestAnimationFrame(() => {
      setIsMounted(true)
      // Auto-scroll to bottom after panel opens
      setTimeout(() => {
        scrollToBottom()
      }, 400)
    })
  }, [isOpen, clientId])

  useEffect(() => {
    if (isOpen) return
    setNoteText('')
    setSelectedFiles([])
    setError(null)
    setUploadProgress({ total: 0, done: 0 })
    // Cleanup object URLs
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current.clear()
  }, [isOpen])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      objectUrlsRef.current.clear()
    }
  }, [])

  const handleFilesSelected = (files: File[]) => {
    if (selectedFiles.length + files.length > INTERNAL_NOTE_MAX_ATTACHMENTS) {
      showError(
        'Attachment Limit',
        `You can add up to ${INTERNAL_NOTE_MAX_ATTACHMENTS} attachments at once.`
      )
      return
    }

    const combinedFiles = [...selectedFiles, ...files]
    
    // Validate all files have allowed extensions
    for (const file of combinedFiles) {
      const extension = getFileExtension(file.name)
      if (!extension || !INTERNAL_NOTE_ALLOWED_EXTENSIONS.includes(extension as any)) {
        showError('Invalid File Type', `"${file.name}" is not a supported file type.`)
        return
      }
    }

    // Check file size
    const oversizeFile = combinedFiles.find(
      (file) => file.size > INTERNAL_NOTE_MAX_ATTACHMENT_SIZE_BYTES
    )
    if (oversizeFile) {
      showError(
        'File Too Large',
        `"${oversizeFile.name}" exceeds ${maxSizeMB} MB limit.`
      )
      return
    }

    // Validate file category consistency
    // Get category of first file (or existing selected files)
    const firstFileCategory = selectedFiles.length > 0 
      ? getFileCategory(getFileExtension(selectedFiles[0].name))
      : getFileCategory(getFileExtension(combinedFiles[0].name))

    if (!firstFileCategory) {
      showError('Invalid File Type', 'Unable to determine file category.')
      return
    }

    // Check if all files belong to the same category
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
      // Cleanup object URL for removed file if it was an image
      const url = objectUrlsRef.current.get(index)
      if (url) {
        URL.revokeObjectURL(url)
        objectUrlsRef.current.delete(index)
      }
      // Clean up all URLs and let them be recreated on next render
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      objectUrlsRef.current.clear()
      return prev.filter((_, fileIndex) => fileIndex !== index)
    })
  }

  const handleUpload = async () => {
    if (!clientId) return
    const trimmedText = noteText.trim()
    if (!trimmedText && selectedFiles.length === 0) {
      showError('Missing Content', 'Please add a note or attach at least one file.')
      return
    }

    setSubmitting(true)
    setUploadProgress({ total: selectedFiles.length, done: 0 })

    let attachments: ClientInternalNoteAttachmentInput[] = []

    if (selectedFiles.length > 0) {
      const signatureResult = await getCloudinaryUploadSignature()
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
            file.type || INTERNAL_NOTE_EXTENSION_MIME_MAP[extension] || 'application/octet-stream'

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

    const result = await createClientInternalNote(clientId, trimmedText || undefined, attachments)
    setSubmitting(false)

    if (result.error) {
      showError('Save Failed', result.error)
      return
    }

    showSuccess('Internal Note Added', 'Your note has been saved.')
    setNoteText('')
    setSelectedFiles([])
    setUploadProgress({ total: 0, done: 0 })
    // Silent refresh - no loading state
    await fetchNotes(true)
  }

  const handleDeleteNoteClick = (noteId: string) => {
    setDeleteNoteModal({
      isOpen: true,
      noteId,
    })
  }

  const handleDeleteNoteConfirm = async () => {
    if (!deleteNoteModal.noteId) return

    setDeletingNote(true)
    const result = await deleteClientInternalNote(deleteNoteModal.noteId)
    setDeletingNote(false)

    if (result.error) {
      showError('Delete Failed', result.error)
      setDeleteNoteModal({ isOpen: false, noteId: null })
      return
    }

    showSuccess('Note Deleted', 'The internal note was removed.')
    setDeleteNoteModal({ isOpen: false, noteId: null })
    // Silent refresh - no loading state
    await fetchNotes(true)
  }

  const handleDeleteNoteCancel = () => {
    setDeleteNoteModal({ isOpen: false, noteId: null })
  }

  const handleStartEdit = (note: ClientInternalNote) => {
    setEditingNoteId(note.id)
    setEditingNoteText(note.note_text || '')
  }

  const handleCancelEdit = () => {
    setEditingNoteId(null)
    setEditingNoteText('')
  }

  const handleSaveEdit = async (noteId: string) => {
    const trimmedText = editingNoteText.trim()
    if (!trimmedText) {
      showError('Invalid Note', 'Note text cannot be empty.')
      return
    }

    setSavingEdit(true)
    const result = await updateClientInternalNote(noteId, trimmedText)
    setSavingEdit(false)

    if (result.error) {
      showError('Update Failed', result.error)
      return
    }

    showSuccess('Note Updated', 'Your note has been updated.')
    setEditingNoteId(null)
    setEditingNoteText('')
    // Silent refresh - no loading state
    await fetchNotes(true)
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
    const result = await deleteClientNoteAttachment(deleteAttachmentModal.attachmentId)
    setDeletingAttachment(false)

    if (result.error) {
      showError('Delete Failed', result.error)
      setDeleteAttachmentModal({ isOpen: false, attachmentId: null, fileName: '' })
      return
    }

    showSuccess('Attachment Deleted', 'The attachment was removed.')
    setDeleteAttachmentModal({ isOpen: false, attachmentId: null, fileName: '' })
    // Silent refresh - no loading state
    await fetchNotes(true)
  }

  const handleDeleteAttachmentCancel = () => {
    setDeleteAttachmentModal({ isOpen: false, attachmentId: null, fileName: '' })
  }

  if (!isOpen || !clientId) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop with fade animation */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 opacity-100"
        onClick={onClose}
      />

      {/* Panel with slide-in animation from right */}
      <div
        className={`relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
          isMounted ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header - Fixed at top */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 flex-shrink-0 bg-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">Internal Notes</p>
            <h2 className="text-lg font-bold text-slate-900">{clientName || 'Client Notes'}</h2>
            <p className="text-xs text-slate-500">Visible to admins and managers only.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
            aria-label="Close internal notes"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Notes List - Scrollable middle section */}
        <div ref={notesListRef} className="flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
          {loading && !isSilentRefresh && (
            <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
              Loading internal notes...
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}
          {!loading && !error && notes.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              No internal notes yet. Add the first one below.
            </div>
          )}

          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Header Section - Distinct from note text */}
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {note.created_by_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(note.created_at)}</p>
                    </div>
                    <Tooltip content="Delete note" position="left">
                      <button
                        onClick={() => handleDeleteNoteClick(note.id)}
                        className="rounded-full border border-slate-200 p-2 text-slate-400 transition-colors duration-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
                        aria-label="Delete note"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {/* Note Text Section - Only show if note has text */}
                {note.note_text && (
                  <div className="px-4 py-4 bg-white">
                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors duration-200 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-200 resize-none min-h-[80px]"
                          placeholder="Write a note..."
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(note.id)}
                            disabled={savingEdit}
                            className="btn-gradient-smooth rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
                          >
                            {savingEdit ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={savingEdit}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900 font-normal flex-1">{note.note_text}</p>
                        <button
                          onClick={() => handleStartEdit(note)}
                          className="flex-shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors duration-200 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer"
                          aria-label="Edit note"
                          title="Edit note"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments Section - Show directly if no text, or with border if text exists */}
                {note.attachments.length > 0 && (
                  <div className={`px-4 pb-4 space-y-2 bg-white ${note.note_text ? 'border-t border-slate-100 pt-4' : 'pt-4'}`}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Attachments
                    </p>
                    <div className="space-y-2">
                      {note.attachments.map((attachment) => {
                        const isImage = attachment.mime_type.startsWith('image/')
                        return (
                          <div
                            key={attachment.id}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 group hover:border-cyan-200 hover:bg-cyan-50 transition-colors duration-200"
                          >
                            <a
                              href={attachment.cloudinary_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400 flex-shrink-0">
                                {isImage ? (
                                  <img
                                    src={attachment.cloudinary_url}
                                    alt={attachment.file_name}
                                    className="h-10 w-10 rounded-lg object-cover"
                                  />
                                ) : (
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-6-8h6M7 20h10a2 2 0 002-2V8l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-slate-700">{attachment.file_name}</p>
                                <p className="text-xs text-slate-400">{formatFileSize(attachment.size_bytes)}</p>
                              </div>
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteAttachmentClick(attachment.id, attachment.file_name)
                              }}
                              className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
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
            ))}
          </div>
        </div>

        {/* Note Form - Sticky at bottom (Compact Design) */}
        <div className="border-t border-slate-200 bg-white px-4 py-2.5 flex-shrink-0 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] flex flex-col" style={{ maxHeight: '40vh' }}>
          {/* Compact Header with title and info text side by side */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-900">Add a new note</h3>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span>Max {INTERNAL_NOTE_MAX_ATTACHMENTS}</span>
              <span>•</span>
              <span>{maxSizeMB}MB</span>
              <span>•</span>
              <span>Same category</span>
            </div>
          </div>

          {/* Attachment previews - Horizontal scroll above textarea */}
          {selectedFiles.length > 0 && (
            <div className="mb-2 overflow-x-auto scrollbar-hide overflow-y-visible pt-2">
              <div className="flex gap-2 pb-1">
                {selectedFiles.map((file, index) => {
                  const isImage = file.type.startsWith('image/')
                  // Create and store object URL if needed
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
                      {/* Delete button - Small but always visible on top layer, positioned to not be cut off */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveFile(index)
                        }}
                        className="absolute top-0 right-0 rounded-full bg-rose-500 text-white p-0.5 opacity-100 transition-all duration-200 cursor-pointer shadow-md hover:bg-rose-600 hover:scale-110 z-50 border border-white"
                        style={{ transform: 'translate(30%, -30%)' }}
                        aria-label="Remove file"
                        title="Remove file"
                      >
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {/* File name overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-[8px] px-1 py-1 truncate">
                        {file.name}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Main content area with textarea and vertical buttons */}
          <div className="flex gap-2 flex-1 min-h-0">
            {/* Textarea - Always visible, full height */}
            <div className="flex-1 flex flex-col min-h-0">
              <textarea
                id="internal-note-text"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Write a note..."
                className="w-full h-full min-h-[100px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors duration-200 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-200 resize-none"
              />
            </div>

            {/* Vertical buttons on the right */}
            <div className="flex flex-col gap-2">
              {/* Attachment button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition-all duration-200 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer min-w-[60px]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828a4 4 0 00-5.656-5.656L6.343 10.172a6 6 0 108.486 8.486L20 13" />
                </svg>
                <span className="text-[10px]">Attachment</span>
              </button>

              {/* Add/Save button */}
              <button
                type="button"
                disabled={submitting}
                onClick={handleUpload}
                className="btn-gradient-smooth flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer min-w-[60px]"
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-[10px]">Saving...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-[10px]">Add</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={INTERNAL_NOTE_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',') + ',image/*'}
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Upload progress */}
          {submitting && uploadProgress.total > 0 && (
            <div className="mt-2 text-center">
              <p className="text-[10px] text-slate-500">
                Uploading {uploadProgress.done}/{uploadProgress.total} files...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Attachment Confirmation Modal */}
      {deleteAttachmentModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={handleDeleteAttachmentCancel} />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-[#1E1B4B]">Delete Attachment</h2>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div className="mb-4 flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
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
                    <span className="font-semibold text-[#1E1B4B]">{deleteAttachmentModal.fileName}</span>? This
                    action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={handleDeleteAttachmentCancel}
                disabled={deletingAttachment}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAttachmentConfirm}
                disabled={deletingAttachment}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {deletingAttachment ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Note Confirmation Modal */}
      {deleteNoteModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={handleDeleteNoteCancel} />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-[#1E1B4B]">Delete Note</h2>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div className="mb-4 flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
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
                    Are you sure you want to delete this internal note? This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={handleDeleteNoteCancel}
                disabled={deletingNote}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteNoteConfirm}
                disabled={deletingNote}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {deletingNote ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
