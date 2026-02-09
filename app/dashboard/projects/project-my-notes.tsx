'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import { EmptyState } from '@/app/components/empty-state'
import {
  createProjectMyNote,
  deleteProjectMyNote,
  getProjectMyNotes,
  updateProjectMyNote,
  type ProjectMyNote,
} from '@/lib/projects/my-notes-actions'

interface ProjectMyNotesProps {
  projectId: string
  userRole: string
  currentUserId: string | undefined
  className?: string
  hideHeader?: boolean
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

export function ProjectMyNotes({
  projectId,
  userRole,
  currentUserId,
  className = '',
  hideHeader = false,
}: ProjectMyNotesProps) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [notes, setNotes] = useState<ProjectMyNote[]>([])
  const canAccess = (userRole === 'staff' || userRole === 'admin' || userRole === 'manager') && Boolean(currentUserId)
  const [loading, setLoading] = useState(canAccess)
  const [error, setError] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<ProjectMyNote | null>(null)
  const [deleting, setDeleting] = useState(false)

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
    if (!canAccess) {
      setLoading(false)
      return
    }
    fetchNotes()
  }, [projectId, canAccess])

  useEffect(() => {
    if (loading || error || notes.length === 0) return
    const el = scrollContainerRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [loading, error, notes.length])

  const handleCreate = async () => {
    if (!canAccess) {
      showError('Read-only Access', 'Only staff, admin, and manager users can add notes.')
      return
    }
    const trimmed = noteText.trim()
    if (!trimmed) {
      showError('Note Required', 'Please enter a note before saving.')
      return
    }

    setSubmitting(true)
    const result = await createProjectMyNote(projectId, trimmed)
    setSubmitting(false)

    if (!result.error && result.data) {
      setNotes((prev) => [...prev, result.data as ProjectMyNote])
      setNoteText('')
      showSuccess('Note Added', 'Your private note has been saved.')
      await fetchNotes({ silent: true })
      router.refresh()
    } else {
      showError('Failed to add note', result.error || 'Unable to save note.')
    }
  }

  const handleStartEdit = (note: ProjectMyNote) => {
    setEditingNoteId(note.id)
    setEditingNoteText(note.note_text)
  }

  const handleCancelEdit = () => {
    setEditingNoteId(null)
    setEditingNoteText('')
  }

  const handleSaveEdit = async () => {
    if (!editingNoteId) return
    const trimmed = editingNoteText.trim()
    if (!trimmed) {
      showError('Note Required', 'Please enter a note before saving.')
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
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide" aria-busy="true" aria-label="Loading notes">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
                  <span className="h-3 w-16 rounded bg-slate-200 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <span className="block h-3 w-full rounded bg-slate-200 animate-pulse" />
                  <span className="block h-3 w-5/6 rounded bg-slate-200 animate-pulse" />
                  <span className="block h-3 w-2/3 rounded bg-slate-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-slate-100 p-4">
          <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          <div className="mt-3 h-10 w-full sm:w-32 rounded-xl bg-slate-200 animate-pulse" />
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
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide">
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
            <div className="space-y-3">
              {notes.map((note) => {
                const edited = isEdited(note)
                const timestamp = edited ? note.updated_at : note.created_at
                return (
                  <div key={note.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Tooltip content={formatDateTime(timestamp)}>
                          <span className="text-xs font-semibold text-slate-500">{getRelativeTime(timestamp)}</span>
                        </Tooltip>
                        {edited && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-full px-2 py-0.5">
                            Edited
                          </span>
                        )}
                      </div>
                      {editingNoteId !== note.id && (
                        <div className="flex items-center gap-1">
                          <Tooltip content="Edit note">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(note)}
                              className="rounded-lg p-1 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
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
                              className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
                      <div className="mt-3 space-y-3">
                        <textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 resize-none"
                        />
                        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={savingEdit}
                            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                          >
                            {savingEdit ? 'Saving...' : 'Save changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap break-words">
                        {note.note_text}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-white/60 p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label
                htmlFor="project-my-note"
                className="text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Add a private note
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <p className="text-[11px] text-slate-500">Only you can see these notes.</p>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={submitting}
                  className="w-full sm:w-auto rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </div>
            <textarea
              id="project-my-note"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Write a quick reminder or personal note..."
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 shadow-sm transition-all duration-300 focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 resize-none"
            />
          </div>
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
    </>
  )
}
