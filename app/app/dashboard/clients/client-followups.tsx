'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getClientFollowUps,
  createClientFollowUp,
  updateClientFollowUp,
  deleteClientFollowUp,
  getLeadFollowUpsForClient,
  ClientFollowUp,
  ClientFollowUpFormData,
} from '@/lib/clients/actions'
import { EmptyState } from '@/app/components/empty-state'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import { FollowUpForm } from '@/app/dashboard/leads/follow-up-form'
import { FollowUpModal } from '@/app/dashboard/leads/follow-up-modal'
import { FollowUpDeleteModal } from '@/app/dashboard/leads/follow-up-delete-modal'

interface ClientFollowUpsProps {
  clientId: string
  leadId: string | null
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

function formatDateOnly(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
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

  // Red: today or past dates
  if (diffDays <= 0) {
    return 'text-red-600 font-bold'
  }

  // Orange: upcoming dates (within next 7 days)
  if (diffDays <= 7) {
    return 'text-orange-600 font-bold'
  }

  // Black: other future dates
  return 'text-[#1E1B4B] font-bold'
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ClientFollowUps({
  clientId,
  leadId,
  canWrite,
  className = '',
  hideHeader = false,
}: ClientFollowUpsProps) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [clientFollowUps, setClientFollowUps] = useState<ClientFollowUp[]>([])
  const [leadFollowUps, setLeadFollowUps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedFollowUp, setSelectedFollowUp] = useState<ClientFollowUp | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchFollowUps = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    if (!silent) {
      setLoading(true)
      setError(null)
    }

    // Fetch client follow-ups
    const clientResult = await getClientFollowUps(clientId)
    if (clientResult.error) {
      if (!silent) {
        setError(clientResult.error)
        setLoading(false)
      } else {
        showError('Refresh Failed', clientResult.error)
      }
      return
    }
    if (clientResult.data) {
      setClientFollowUps(clientResult.data)
    }

    // Fetch lead follow-ups if client was converted from a lead
    if (leadId) {
      const leadResult = await getLeadFollowUpsForClient(leadId)
      if (leadResult.data) {
        setLeadFollowUps(leadResult.data)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchFollowUps()
  }, [clientId, leadId])

  useEffect(() => {
    if (loading || error) return
    const totalCount = clientFollowUps.length + leadFollowUps.length
    if (totalCount === 0) return

    const el = scrollContainerRef.current
    if (!el) return

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [loading, error, clientFollowUps.length, leadFollowUps.length])

  const handleCreate = async (formData: ClientFollowUpFormData) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to add follow-ups.')
      return { error: 'Permission denied' }
    }
    setSubmitting(true)
    const result = await createClientFollowUp(clientId, formData)
    setSubmitting(false)

    if (!result.error) {
      showSuccess('Follow-up Added', 'The interaction has been recorded.')
      if (result.data) {
        const optimisticFollowUp: ClientFollowUp = {
          id: result.data.id,
          client_id: result.data.client_id,
          note: result.data.note,
          follow_up_date: result.data.follow_up_date,
          created_by: result.data.created_by,
          created_by_name: 'You',
          created_at: result.data.created_at || new Date().toISOString(),
          updated_at: result.data.updated_at || new Date().toISOString(),
        }
        setClientFollowUps((prev) => [...prev, optimisticFollowUp])
      }
      await fetchFollowUps({ silent: true })
      router.refresh()
      // Reset form
      const form = document.getElementById('add-client-followup-form') as HTMLFormElement
      if (form) {
        form.reset()
      }
    } else {
      showError('Failed to add follow-up', result.error)
    }
    return result
  }

  const handleEdit = (followUp: ClientFollowUp) => {
    setSelectedFollowUp(followUp)
    setEditModalOpen(true)
  }

  const handleUpdate = async (formData: ClientFollowUpFormData) => {
    if (!selectedFollowUp) return { error: 'No follow-up selected' }
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to update follow-ups.')
      return { error: 'Permission denied' }
    }

    setSubmitting(true)
    const result = await updateClientFollowUp(selectedFollowUp.id, formData)
    setSubmitting(false)

    if (!result.error) {
      showSuccess('Follow-up Updated', 'The changes have been saved.')
      setClientFollowUps((prev) =>
        prev.map((item) =>
          item.id === selectedFollowUp.id
            ? {
              ...item,
              note: formData.note?.trim() || null,
              follow_up_date: formData.follow_up_date || null,
              updated_at: new Date().toISOString(),
            }
            : item
        )
      )
      await fetchFollowUps({ silent: true })
      router.refresh()
      setEditModalOpen(false)
      setSelectedFollowUp(null)
    } else {
      showError('Update Failed', result.error)
    }
    return result
  }

  const handleDelete = (followUp: ClientFollowUp) => {
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
    const result = await deleteClientFollowUp(selectedFollowUp.id)
    setDeleting(false)

    if (!result.error) {
      showSuccess('Follow-up Deleted', 'The record has been removed.')
      setClientFollowUps((prev) => prev.filter((item) => item.id !== selectedFollowUp.id))
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

  const getInitialEditData = (): Partial<ClientFollowUpFormData> | undefined => {
    if (!selectedFollowUp) return undefined
    return {
      follow_up_date: selectedFollowUp.follow_up_date || undefined,
      note: selectedFollowUp.note || undefined,
    }
  }

  if (loading) {
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
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-md p-3 sm:p-4 border border-gray-100">
              <div className="flex gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 rounded-full bg-gray-200 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-full rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
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

  const allFollowUpsEmpty = leadFollowUps.length === 0 && clientFollowUps.length === 0

  return (
    <div className={`h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
      {/* Header Section */}
      {!hideHeader && (
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white/80 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#0891b2] flex items-center justify-center shadow-lg shadow-cyan-200/50">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold text-[#0C4A6E] tracking-tight">Timeline</h4>
          </div>
        </div>
      )}

      {/* Scrollable Timeline */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 scrollbar-hide">
        {allFollowUpsEmpty ? (
          <div className="flex h-full items-center justify-center">
            <div className="w-full max-w-[280px]">
              <EmptyState
                variant="followups"
                title="No interactions"
                description="Start the conversation by adding a follow-up note below."
              />
            </div>
          </div>
        ) : (
          <div className="relative space-y-3 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-cyan-500/20 before:via-cyan-500/10 before:to-transparent">
            {/* Lead Follow-ups (Read-only) */}
            {leadFollowUps.length > 0 && leadFollowUps.map((followUp, index) => (
              <div key={`lead-${followUp.id}`} className={`relative pl-12 animate-stagger-${Math.min(index + 1, 5)}`}>
                {/* Timeline Dot */}
                <div className="absolute left-0 top-0 mt-1.5 h-10 w-10 flex items-center justify-center z-10">
                  <div className="h-3 w-3 rounded-full bg-white border-2 border-slate-400 shadow-[0_0_0_4px_rgba(100,116,139,0.1)]"></div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm opacity-75">
                  {/* Read-only badge */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-600 uppercase tracking-wider">
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Lead Follow-up (Read-only)
                    </span>
                  </div>

                  {/* Interaction Header */}
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
                  </div>

                  {/* Content */}
                  {followUp.note ? (
                    <div className="relative">
                      <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                        {followUp.note}
                      </p>
                    </div>
                  ) : followUp.follow_up_date ? (
                    <div className="relative">
                      <p className="text-[13px] text-slate-500 italic">
                          Reminder set (no interaction note)
                      </p>
                    </div>
                  ) : null}

                  {/* Footer: Date Reminder */}
                  {followUp.follow_up_date && (
                    <div className="mt-2 pt-2 border-t border-slate-50 flex items-center gap-2">
                      <div className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 inline-flex items-center gap-1.5">
                        <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${getFollowUpDateColor(followUp.follow_up_date)}`}>
                          Next: {formatDateOnly(followUp.follow_up_date)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Separator between Lead and Client Follow-ups */}
            {leadFollowUps.length > 0 && clientFollowUps.length > 0 && (
              <div className="relative pl-12 py-2">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center z-10">
                  <div className="h-4 w-4 rounded-full bg-cyan-500 border-4 border-white shadow-lg"></div>
                </div>
                <div className="bg-gradient-to-r from-transparent via-cyan-200 to-transparent h-px"></div>
                <div className="text-center mt-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-[10px] font-bold text-cyan-700 uppercase tracking-wider">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Client Follow-ups
                  </span>
                </div>
              </div>
            )}

            {/* Client Follow-ups (Editable) */}
            {clientFollowUps.map((followUp, index) => {
              const canEdit = canWrite
              return (
                <div key={followUp.id} className={`relative pl-12 animate-stagger-${Math.min(leadFollowUps.length + index + 1, 5)}`}>
                  {/* Timeline Dot */}
                  <div className="absolute left-0 top-0 mt-1.5 h-10 w-10 flex items-center justify-center z-10">
                    <div className="h-3 w-3 rounded-full bg-white border-2 border-cyan-500 shadow-[0_0_0_4px_rgba(6,182,212,0.1)]"></div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                    {/* Interaction Header */}
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

                    {/* Content */}
                    {followUp.note ? (
                      <div className="relative">
                        <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                          {followUp.note}
                        </p>
                      </div>
                    ) : followUp.follow_up_date ? (
                      <div className="relative">
                        <p className="text-[13px] text-slate-500 italic">
                          Reminder set (no interaction note)
                        </p>
                      </div>
                    ) : null}

                    {/* Footer: Date Reminder */}
                    {followUp.follow_up_date && (
                      <div className="mt-2 pt-2 border-t border-slate-50 flex items-center gap-2">
                        <div className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 inline-flex items-center gap-1.5">
                          <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${getFollowUpDateColor(followUp.follow_up_date)}`}>
                            Next: {formatDateOnly(followUp.follow_up_date)}
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

      {/* Quick Add Form Section */}
      <div className="p-3 border-t border-slate-100 bg-white/60 rounded-b-2xl">
        {canWrite ? (
          <form
            id="add-client-followup-form"
              onSubmit={async (e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const followUpData: ClientFollowUpFormData = {
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

      {/* Edit Modal */}
      <FollowUpModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setSelectedFollowUp(null)
        }}
        mode="edit"
        initialData={getInitialEditData() as any}
        onSubmit={handleUpdate as any}
      />

      {/* Delete Confirmation Modal */}
      {selectedFollowUp && (
        <FollowUpDeleteModal
          isOpen={deleteModalOpen}
          onClose={handleCloseDelete}
          onConfirm={handleConfirmDelete}
          followUpDate={selectedFollowUp.follow_up_date || new Date().toISOString()}
          isLoading={deleting}
        />
      )}
    </div>
  )
}
