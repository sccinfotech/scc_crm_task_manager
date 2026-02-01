'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getLeadFollowUps,
  createLeadFollowUp,
  updateLeadFollowUp,
  deleteLeadFollowUp,
  LeadFollowUp,
  LeadFollowUpFormData,
} from '@/lib/leads/actions'
import { FollowUpForm } from './follow-up-form'
import { FollowUpModal } from './follow-up-modal'
import { FollowUpDeleteModal } from './follow-up-delete-modal'
import { EmptyState } from '@/app/components/empty-state'

interface LeadFollowUpsProps {
  leadId: string
  currentUserId: string
  userRole: string
  leadFollowUpDate?: string | null
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatFollowUpDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
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

function getFollowUpDateColor(dateString: string): string {
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

export function LeadFollowUps({
  leadId,
  currentUserId,
  userRole,
  leadFollowUpDate,
}: LeadFollowUpsProps) {
  const router = useRouter()
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedFollowUp, setSelectedFollowUp] = useState<LeadFollowUp | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchFollowUps = async () => {
    setLoading(true)
    setError(null)

    const result = await getLeadFollowUps(leadId)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.data) {
      setFollowUps(result.data)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchFollowUps()
  }, [leadId])

  const canEditFollowUp = (followUp: LeadFollowUp) => {
    return userRole === 'admin' || followUp.created_by === currentUserId
  }

  const handleCreate = async (formData: LeadFollowUpFormData) => {
    setSubmitting(true)
    const result = await createLeadFollowUp(leadId, formData)
    setSubmitting(false)

    if (!result.error) {
      await fetchFollowUps()
      router.refresh()
      // Reset form by clearing the form fields
      const form = document.getElementById('add-followup-form') as HTMLFormElement
      if (form) {
        form.reset()
      }
    }
    return result
  }

  const handleEdit = (followUp: LeadFollowUp) => {
    setSelectedFollowUp(followUp)
    setEditModalOpen(true)
  }

  const handleUpdate = async (formData: LeadFollowUpFormData) => {
    if (!selectedFollowUp) return { error: 'No follow-up selected' }

    setSubmitting(true)
    const result = await updateLeadFollowUp(selectedFollowUp.id, formData)
    setSubmitting(false)

    if (!result.error) {
      await fetchFollowUps()
      router.refresh()
      setEditModalOpen(false)
      setSelectedFollowUp(null)
    }
    return result
  }

  const handleDelete = (followUp: LeadFollowUp) => {
    setSelectedFollowUp(followUp)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedFollowUp) return

    setDeleting(true)
    const result = await deleteLeadFollowUp(selectedFollowUp.id)
    setDeleting(false)

    if (!result.error) {
      await fetchFollowUps()
      router.refresh()
      setDeleteModalOpen(false)
      setSelectedFollowUp(null)
    }
  }

  const handleCloseDelete = () => {
    setDeleteModalOpen(false)
    setSelectedFollowUp(null)
  }

  const getInitialEditData = (): Partial<LeadFollowUpFormData> | undefined => {
    if (!selectedFollowUp) return undefined
    return {
      follow_up_date: selectedFollowUp.follow_up_date,
      note: selectedFollowUp.note,
    }
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col px-2 py-2 sm:px-3 sm:py-3">
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
      <div className="h-full flex flex-col px-2 py-2 sm:px-3 sm:py-3">
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
      <div className="h-full flex flex-col px-2 py-2 sm:px-3 sm:py-3 border-l border-gray-200">
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
            {leadFollowUpDate && (
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-medium text-gray-600">Next Follow-up Date:</span>
                <span className="text-sm sm:text-base font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                  {new Date(leadFollowUpDate).toLocaleDateString('en-US', {
                    year: '2-digit',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Follow-Ups List */}
        <div className="flex-1 overflow-y-auto pb-2">

          {followUps.length === 0 ? (
            <div className="flex h-full min-h-[400px] items-center justify-center w-full">
              <div className="w-full max-w-md">
                <EmptyState
                  variant="followups"
                  title="No follow-ups yet"
                  description="Start tracking your interactions by adding your first follow-up. Keep notes and schedule next steps to stay organized."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 pr-1">
              {followUps.map((followUp) => {
                const canEdit = canEditFollowUp(followUp)
                return (
                  <div key={followUp.id}>
                    <div className="bg-white rounded-xl shadow-md p-3 sm:p-4 border-2 border-gray-200 hover:shadow-lg transition-all hover:border-[#06B6D4]/40">
                      {/* Top Section: Creator and Actions */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Creator Profile Icon and Name */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#06B6D4] to-[#0891b2] flex items-center justify-center shadow-sm">
                              <span className="text-xs font-bold text-white">
                                {getInitials(followUp.created_by_name)}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-[#06B6D4] whitespace-nowrap">
                              {followUp.created_by_name || 'Unknown User'}
                            </span>
                          </div>
                        </div>
                        {/* Edit/Delete Actions */}
                        {canEdit && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleEdit(followUp)}
                              className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-purple-50 hover:text-[#7C3AED] hover:shadow-sm"
                              aria-label="Edit follow-up"
                              title="Edit"
                            >
                              <svg
                                className="h-4 w-4 sm:h-5 sm:w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(followUp)}
                              className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-red-50 hover:text-red-600 hover:shadow-sm"
                              aria-label="Delete follow-up"
                              title="Delete"
                            >
                              <svg
                                className="h-4 w-4 sm:h-5 sm:w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Note Content */}
                      <div className="bg-gray-50 rounded-lg p-2 sm:p-3 mb-2 border border-gray-200">
                        <p className="whitespace-pre-wrap text-sm sm:text-base text-[#1E1B4B] leading-relaxed">
                          {followUp.note}
                        </p>
                      </div>

                      {/* Bottom Metadata */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm pt-2">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">Created: {formatDate(followUp.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-600">Next: <span className={`font-bold ${getFollowUpDateColor(followUp.follow_up_date)}`}>{formatDateOnly(followUp.follow_up_date)}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Always Visible Add Follow-Up Form */}
        <div className="border-t border-gray-200 bg-white shadow-lg mt-2">
          <div className="p-2 sm:p-3">
            <form
              id="add-followup-form"
              onSubmit={async (e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const followUpData: LeadFollowUpFormData = {
                  follow_up_date: formData.get('follow_up_date') as string,
                  note: formData.get('note') as string,
                }
                await handleCreate(followUpData)
              }}
              className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-end"
            >
              {/* Note/Remark Field - What happened in this follow-up */}
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-xs text-gray-500 mb-1.5">Add Follow-up</label>
                <input
                  type="text"
                  name="note"
                  required
                  placeholder="Add remark..."
                  title="Describe what was discussed or what action was taken during this follow-up"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20"
                />
              </div>

              {/* Date Field with Label */}
              <div className="flex-1 sm:flex-initial sm:w-48">
                <label className="block text-xs text-gray-500 mb-1.5">Next Follow-up Date</label>
                <div className="relative">
                  <input
                    type="date"
                    name="follow_up_date"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pl-10 pr-10 text-sm text-[#1E1B4B] shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      const form = e.currentTarget.closest('form')
                      const input = form?.querySelector('input[name="follow_up_date"]') as HTMLInputElement
                      if (input) {
                        if (typeof input.showPicker === 'function') {
                          input.showPicker()
                        } else {
                          input.focus()
                          input.click()
                        }
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer"
                    aria-label="Open date picker"
                  >
                    <svg
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={submitting}
                className="flex-shrink-0 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white rounded-lg px-6 py-2.5 text-sm font-semibold shadow-md transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <FollowUpModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setSelectedFollowUp(null)
        }}
        mode="edit"
        initialData={getInitialEditData()}
        onSubmit={handleUpdate}
      />

      {/* Delete Confirmation Modal */}
      {selectedFollowUp && (
        <FollowUpDeleteModal
          isOpen={deleteModalOpen}
          onClose={handleCloseDelete}
          onConfirm={handleConfirmDelete}
          followUpDate={selectedFollowUp.follow_up_date}
          isLoading={deleting}
        />
      )}
    </>
  )
}

