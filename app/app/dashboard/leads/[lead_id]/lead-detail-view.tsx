'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Lead, LeadStatus, getLead, updateLead, deleteLead, LeadFormData } from '@/lib/leads/actions'
import { LeadFollowUps } from '../lead-followups'
import { LeadForm } from '../lead-form'
import { LeadModal } from '../lead-modal'
import { DeleteConfirmModal } from '../delete-confirm-modal'

interface LeadDetailViewProps {
  lead: Lead
  currentUserId: string
  userRole: string
}

function StatusPill({ status }: { status: LeadStatus }) {
  const statusStyles = {
    new: 'bg-gradient-to-r from-cyan-100 to-cyan-200 text-cyan-800 border-cyan-300 shadow-sm',
    contacted: 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-300 shadow-sm',
    follow_up: 'bg-gradient-to-r from-purple-200 to-purple-300 text-purple-900 border-purple-400 shadow-sm',
    converted: 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-300 shadow-sm',
    lost: 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-red-300 shadow-sm',
  }

  const statusLabels = {
    new: 'New',
    contacted: 'Contacted',
    follow_up: 'Follow Up',
    converted: 'Converted',
    lost: 'Lost',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold border ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  )
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function LeadDetailView({
  lead: initialLead,
  currentUserId,
  userRole,
}: LeadDetailViewProps) {
  const router = useRouter()
  const [lead, setLead] = useState<Lead>(initialLead)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canEdit = userRole === 'admin' || lead.created_by === currentUserId
  const canDelete = canEdit

  const handleBack = () => {
    router.push('/dashboard/leads')
  }

  const handleEdit = () => {
    setEditModalOpen(true)
  }

  const handleEditSuccess = async () => {
    // Refresh lead data after edit
    setLoading(true)
    const result = await getLead(lead.id)
    setLoading(false)
    if (result.data) {
      setLead(result.data)
    }
    setEditModalOpen(false)
    // Refresh the page to ensure all data is up to date
    router.refresh()
  }

  const handleDelete = () => {
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    const result = await deleteLead(lead.id)
    setDeleting(false)

    if (!result.error) {
      router.push('/dashboard/leads')
    } else {
      alert(result.error || 'Failed to delete lead')
      setDeleteModalOpen(false)
    }
  }

  const handleCloseDelete = () => {
    setDeleteModalOpen(false)
  }

  const getInitialEditData = (): LeadFormData => {
    return {
      name: lead.name,
      company_name: lead.company_name || undefined,
      phone: lead.phone,
      source: lead.source || undefined,
      status: lead.status,
      follow_up_date: lead.follow_up_date || undefined,
      notes: lead.notes || undefined,
    }
  }

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Page Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="rounded-lg p-2 text-gray-600 transition-all hover:bg-gray-100 hover:text-[#06B6D4]"
              aria-label="Back to leads list"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-[#1E1B4B]">Lead Details</h1>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={handleEdit}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-[#7C3AED] transition-all hover:bg-purple-50 hover:shadow-md"
                aria-label="Edit lead"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4"
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
                  <span>Edit</span>
                </div>
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 hover:shadow-md"
                aria-label="Delete lead"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4"
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
                  <span>Delete</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Content - Two Column Layout */}
        <div className="flex-1 overflow-hidden">
          <div className="flex h-full flex-col gap-6 lg:flex-row">
            {/* Left Section - Lead Information */}
            <div className="flex-1 overflow-y-auto lg:pr-6">
              <div className="space-y-6">
                {/* Lead Basic Info Card */}
                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-r from-[#06B6D4] to-[#0891b2] flex items-center justify-center shadow-md flex-shrink-0">
                          <span className="text-xl font-bold text-white">
                            {getInitials(lead.name)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-2xl font-bold text-[#1E1B4B]">{lead.name}</h2>
                          {lead.company_name && (
                            <p className="mt-1 text-base text-gray-600 font-medium">{lead.company_name}</p>
                          )}
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span className="text-base font-semibold text-[#1E1B4B]">{lead.phone}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(lead.phone)
                                }}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-[#06B6D4] transition-all"
                                aria-label="Copy phone number"
                                title="Copy"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              <a
                                href={`tel:${lead.phone}`}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-green-100 hover:text-green-600 transition-all"
                                aria-label="Call phone number"
                                title="Call"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <StatusPill status={lead.status} />
                    </div>
                  </div>
                </div>

                {/* Additional Information Grid */}
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
                  {lead.source && (
                    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-6 w-6 rounded bg-purple-100 flex items-center justify-center">
                          <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Source
                        </p>
                      </div>
                      <p className="text-base font-semibold text-[#1E1B4B] mt-1">{lead.source}</p>
                    </div>
                  )}
                  {lead.follow_up_date && (
                    <div className="rounded-xl bg-gradient-to-br from-orange-50 to-red-50 p-5 shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-6 w-6 rounded bg-orange-100 flex items-center justify-center">
                          <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">
                          Next Follow-Up Date
                        </p>
                      </div>
                      <p className="text-base font-bold text-orange-600 mt-1">
                        {formatDateOnly(lead.follow_up_date)}
                      </p>
                    </div>
                  )}
                  <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded bg-green-100 flex items-center justify-center">
                        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Created
                      </p>
                    </div>
                    <p className="text-base font-semibold text-[#1E1B4B] mt-1">
                      {formatDate(lead.created_at)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded bg-blue-100 flex items-center justify-center">
                        <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Last Updated
                      </p>
                    </div>
                    <p className="text-base font-semibold text-[#1E1B4B] mt-1">
                      {formatDate(lead.updated_at)}
                    </p>
                  </div>
                </div>

                {/* Notes Card */}
                {lead.notes && (
                  <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 p-6 shadow-sm border border-purple-100">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-[#7C3AED] flex items-center justify-center">
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <h4 className="text-base font-bold text-[#1E1B4B]">Notes</h4>
                    </div>
                    <div className="rounded-lg bg-white p-4 shadow-sm border border-purple-100">
                      <p className="whitespace-pre-wrap text-base text-[#1E1B4B] leading-relaxed">
                        {lead.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Section - Follow-Ups */}
            <div className="w-full lg:w-1/2 overflow-hidden flex flex-col">
              <LeadFollowUps
                leadId={lead.id}
                currentUserId={currentUserId}
                userRole={userRole}
                leadFollowUpDate={lead.follow_up_date}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <LeadModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          mode="edit"
          initialData={getInitialEditData()}
          onSubmit={async (formData: LeadFormData) => {
            const result = await updateLead(lead.id, formData)
            if (!result.error) {
              await handleEditSuccess()
            }
            return result
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={handleCloseDelete}
          onConfirm={handleConfirmDelete}
          leadName={lead.name}
          isLoading={deleting}
        />
      )}
    </>
  )
}

