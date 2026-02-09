'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getProjectFollowUps,
  createProjectFollowUp,
  updateProjectFollowUp,
  deleteProjectFollowUp,
  ProjectFollowUp,
  ProjectFollowUpFormData,
} from '@/lib/projects/actions'
import { FollowUpForm } from './follow-up-form'
import { FollowUpModal } from './follow-up-modal'
import { FollowUpDeleteModal } from './follow-up-delete-modal'
import { EmptyState } from '@/app/components/empty-state'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'

interface ProjectFollowUpsProps {
  projectId: string
  initialFollowUps?: ProjectFollowUp[]
  canWrite: boolean
  className?: string
  hideHeader?: boolean
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateOnly(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`

  return formatDate(dateString)
}

function getFollowUpDateColor(dateString: string | null): string {
  if (!dateString) return 'text-gray-500'

  const followUpDate = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const followUpDateOnly = new Date(followUpDate)
  followUpDateOnly.setHours(0, 0, 0, 0)

  const diffTime = followUpDateOnly.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) {
    return 'text-red-600 font-bold'
  }

  if (diffDays <= 7) {
    return 'text-orange-600 font-bold'
  }

  return 'text-[#1E1B4B] font-bold'
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ProjectFollowUps({
  projectId,
  initialFollowUps = [],
  canWrite,
  className = '',
  hideHeader = false,
}: ProjectFollowUpsProps) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [followUps, setFollowUps] = useState<ProjectFollowUp[]>(initialFollowUps)
  const [loading, setLoading] = useState(initialFollowUps.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedFollowUp, setSelectedFollowUp] = useState<ProjectFollowUp | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchFollowUps = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    if (!silent) {
      setLoading(true)
      setError(null)
    }

    const result = await getProjectFollowUps(projectId)

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
      setFollowUps(result.data)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (initialFollowUps.length > 0) {
      fetchFollowUps({ silent: true })
    } else {
      fetchFollowUps()
    }
  }, [projectId])

  useEffect(() => {
    if (loading || error) return
    if (followUps.length === 0) return

    const el = scrollContainerRef.current
    if (!el) return

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [loading, error, followUps.length])

  const handleCreate = async (formData: ProjectFollowUpFormData) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to add follow-ups.')
      return { error: 'Permission denied' }
    }
    setSubmitting(true)
    const result = await createProjectFollowUp(projectId, formData)
    setSubmitting(false)

    if (!result.error) {
      showSuccess('Follow-up Added', 'The interaction has been recorded.')
      if (result.data) {
        const optimisticFollowUp: ProjectFollowUp = {
          id: result.data.id,
          project_id: result.data.project_id,
          note: result.data.note,
          follow_up_date: result.data.follow_up_date,
          next_follow_up_date: result.data.next_follow_up_date,
          created_by: result.data.created_by,
          created_by_name: 'You',
          created_at: result.data.created_at || new Date().toISOString(),
          updated_at: result.data.updated_at || new Date().toISOString(),
        }
        setFollowUps((prev) => [...prev, optimisticFollowUp])
      }
      await fetchFollowUps({ silent: true })
      router.refresh()
      const form = document.getElementById('add-followup-form') as HTMLFormElement
      if (form) {
        form.reset()
      }
    } else {
      showError('Failed to add follow-up', result.error)
    }
    return result
  }

  const handleEdit = (followUp: ProjectFollowUp) => {
    setSelectedFollowUp(followUp)
    setEditModalOpen(true)
  }

  const handleUpdate = async (formData: ProjectFollowUpFormData) => {
    if (!selectedFollowUp) return { error: 'No follow-up selected' }
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to update follow-ups.')
      return { error: 'Permission denied' }
    }

    setSubmitting(true)
    const result = await updateProjectFollowUp(selectedFollowUp.id, formData)
    setSubmitting(false)

    if (!result.error) {
      showSuccess('Follow-up Updated', 'Changes have been saved.')
      setEditModalOpen(false)
      setSelectedFollowUp(null)
      await fetchFollowUps({ silent: true })
      router.refresh()
    } else {
      showError('Update Failed', result.error)
    }
    return result
  }

  const handleDelete = (followUp: ProjectFollowUp) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to delete follow-ups.')
      return
    }
    setSelectedFollowUp(followUp)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedFollowUp) return
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to delete follow-ups.')
      return
    }

    setDeleting(true)
    const result = await deleteProjectFollowUp(selectedFollowUp.id)
    setDeleting(false)

    if (!result.error) {
      showSuccess('Follow-up Deleted', 'The record has been removed.')
      setFollowUps((prev) => prev.filter((item) => item.id !== selectedFollowUp.id))
      await fetchFollowUps({ silent: true })
      router.refresh()
      setDeleteModalOpen(false)
      setSelectedFollowUp(null)
    } else {
      showError('Delete Failed', result.error || 'Failed to delete follow-up')
    }
  }

  const handleCloseDelete = () => {
    setDeleteModalOpen(false)
    setSelectedFollowUp(null)
  }

  const getInitialEditData = (): Partial<ProjectFollowUpFormData> | undefined => {
    if (!selectedFollowUp) return undefined
    const reminderDate = selectedFollowUp.follow_up_date || selectedFollowUp.next_follow_up_date
    return {
      follow_up_date: reminderDate || undefined,
      note: selectedFollowUp.note || undefined,
    }
  }

  if (loading && followUps.length === 0) {
    return (
      <div className={`h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
        {!hideHeader && (
          <div className="mb-2 sm:mb-3 px-2 pt-2 sm:px-3 sm:pt-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#0891b2] flex items-center justify-center shadow-md">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-[#1E1B4B]">Follow-Ups</h4>
            </div>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <svg className="h-8 w-8 animate-spin text-[#06B6D4]" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-medium">Loading follow-ups...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col px-2 py-2 sm:px-3 sm:py-3 bg-white">
        <div className="mb-2 sm:mb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#0891b2] flex items-center justify-center shadow-md">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-[#1E1B4B]">Follow-Ups</h4>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm font-medium text-red-800">Error loading follow-ups: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
        {!hideHeader && (
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white/80 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#0891b2] flex items-center justify-center shadow-lg shadow-cyan-200/50">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold text-[#0C4A6E] tracking-tight">Follow-Ups</h4>
              {loading && (
                <span className="text-xs text-cyan-600 flex items-center gap-1.5 font-medium">
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 scrollbar-hide">
          {followUps.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="w-full max-w-[280px]">
                <EmptyState
                  variant="followups"
                  title="No interactions"
                  description="Start by adding a follow-up note below."
                />
              </div>
            </div>
          ) : (
            <div className="relative space-y-3 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-cyan-500/20 before:via-cyan-500/10 before:to-transparent">
              {followUps.map((followUp, index) => {
                const canEdit = canWrite
                return (
                  <div key={followUp.id} className={`relative pl-12 animate-stagger-${Math.min(index + 1, 5)}`}>
                    <div className="absolute left-0 top-0 mt-1.5 h-10 w-10 flex items-center justify-center z-10">
                      <div className="h-3 w-3 rounded-full bg-white border-2 border-cyan-500 shadow-[0_0_0_4px_rgba(6,182,212,0.1)]"></div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm font-bold text-slate-600 text-xs">
                            {getInitials(followUp.created_by_name)}
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-slate-800 leading-none mb-0.5 font-['Plus_Jakarta_Sans',sans-serif]">
                              {followUp.created_by_name || 'System'}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                              {getRelativeTime(followUp.created_at)}
                            </p>
                          </div>
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <Tooltip content="Edit interaction">
                              <button
                                onClick={() => handleEdit(followUp)}
                                className="p-1 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors border border-transparent hover:border-cyan-100"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </Tooltip>
                            <Tooltip content="Delete record">
                              <button
                                onClick={() => handleDelete(followUp)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </Tooltip>
                          </div>
                        )}
                      </div>

                      {followUp.note ? (
                        <div className="relative">
                          <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                            {followUp.note}
                          </p>
                        </div>
                      ) : followUp.follow_up_date || followUp.next_follow_up_date ? (
                        <div className="relative">
                          <p className="text-[13px] text-slate-500 italic">
                            Reminder set (no interaction note)
                          </p>
                        </div>
                      ) : null}

                      {/* Footer: single reminder date (same as client) */}
                      {(followUp.follow_up_date || followUp.next_follow_up_date) && (
                        <div className="mt-2 pt-2 border-t border-slate-50 flex items-center gap-2">
                          <div className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 inline-flex items-center gap-1.5">
                            <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${getFollowUpDateColor(followUp.follow_up_date || followUp.next_follow_up_date || null)}`}>
                              Next: {formatDateOnly(followUp.follow_up_date || followUp.next_follow_up_date!)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-100 bg-white/60 rounded-b-2xl">
          {canWrite ? (
            <form
              id="add-followup-form"
              onSubmit={async (e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const followUpData: ProjectFollowUpFormData = {
                  follow_up_date: (formData.get('follow_up_date') as string) || undefined,
                  note: (formData.get('note') as string) || undefined,
                }
                await handleCreate(followUpData)
              }}
              className="space-y-4"
            >
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-2">
                  Add a note or set a reminder date (at least one is required)
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                <div className="sm:col-span-12">
                  <div className="relative group">
                    <textarea
                      name="note"
                      placeholder="Briefly describe the interaction (optional)..."
                      rows={2}
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 shadow-sm transition-all duration-300 focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 resize-none group-hover:border-slate-300"
                    ></textarea>
                  </div>
                </div>
                <div className="sm:col-span-8">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="date"
                      name="follow_up_date"
                      className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 pl-11 text-xs font-bold text-slate-700 shadow-sm transition-all duration-300 focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
                    />
                    <div className="absolute -top-2.5 left-4 px-1 bg-white text-[10px] font-bold text-cyan-600 uppercase tracking-widest border border-cyan-50 rounded">Set Reminder (Optional)</div>
                  </div>
                </div>
                <div className="sm:col-span-4 h-full">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-[41px] btn-gradient-smooth rounded-xl flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-cyan-500/20 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {submitting ? (
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm">Log Note</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-medium text-slate-500">
              Read-only access. You can view follow-ups but cannot add or edit them.
            </div>
          )}
        </div>
      </div>

      <FollowUpModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        mode="edit"
        initialData={getInitialEditData()}
        onSubmit={handleUpdate}
      />

      <FollowUpDeleteModal
        isOpen={deleteModalOpen}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        isLoading={deleting}
      />
    </>
  )
}
