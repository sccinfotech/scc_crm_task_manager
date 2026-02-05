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
    new: 'bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200 hover:shadow-md',
    contacted: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200 hover:shadow-md',
    follow_up: 'bg-gradient-to-r from-[#06B6D4] to-[#0891b2] text-white border-[#0891b2] hover:shadow-lg',
    converted: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200 hover:shadow-md',
    lost: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200 hover:shadow-md',
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
      className={`inline-flex items-center rounded-full px-5 py-2 text-sm font-bold border-2 transition-all duration-200 ${statusStyles[status]}`}
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
  const [mobileFollowUpsOpen, setMobileFollowUpsOpen] = useState(false)

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
      <div className="flex h-full flex-col lg:flex-row gap-6">

        {/* LEFT COLUMN: Lead Details (Full width on mobile, 50% on desktop) */}
        <div className="w-full lg:w-1/2 flex flex-col gap-5 overflow-y-auto pb-24 lg:pb-0 scrollbar-hide">

          {/* Main Card */}
          <div className="rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden relative">

            {/* 1. Header Section */}
            <div className="relative bg-gradient-to-r from-[#06B6D4] to-[#0891b2] p-6">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center shadow-lg transform rotate-3">
                    <span className="text-2xl font-bold text-white drop-shadow-md">
                      {getInitials(lead.name)}
                    </span>
                  </div>

                  {/* Name & Status */}
                  <div className="flex flex-col gap-2">
                    <h1 className="font-['Poppins',sans-serif] text-2xl font-bold text-white tracking-tight">
                      {lead.name}
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusPill status={lead.status} />
                      {lead.company_name && (
                        <span className="hidden sm:inline-flex items-center text-cyan-50 font-medium text-sm px-2 py-0.5 rounded-md bg-white/10">
                          {lead.company_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop Actions (Hidden on Mobile) */}
                <div className="hidden lg:flex items-start gap-1 p-1 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                  {canEdit && (
                    <button
                      onClick={handleEdit}
                      className="p-2.5 text-white hover:bg-white/20 rounded-lg transition-all active:scale-95"
                      title="Edit Lead"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => navigator.clipboard.writeText(lead.phone)}
                    className="p-2.5 text-white hover:bg-white/20 rounded-lg transition-all active:scale-95"
                    title="Copy Phone"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                  <a
                    href={`tel:${lead.phone}`}
                    className="p-2.5 text-white hover:bg-white/20 rounded-lg transition-all active:scale-95"
                    title="Call Lead"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </a>
                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      className="p-2.5 text-red-50 hover:bg-red-500/20 rounded-lg transition-all active:scale-95 hover:text-white"
                      title="Delete Lead"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Contact Details (Line-wise Layout) */}
            <div className="p-6 flex flex-col gap-4">
              {/* Phone */}
              <div className="flex items-center gap-4 group">
                <div className="h-10 w-10 rounded-xl bg-cyan-50 flex items-center justify-center text-[#06B6D4] group-hover:bg-[#06B6D4] group-hover:text-white transition-colors shadow-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Phone Number</p>
                  <p className="text-base font-bold text-[#0C4A6E] font-['Poppins',sans-serif]">{lead.phone}</p>
                </div>
              </div>

              {/* Company */}
              {lead.company_name && (
                <div className="flex items-center gap-4 group">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-sm">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Company</p>
                    <p className="text-base font-bold text-[#0C4A6E] font-['Poppins',sans-serif]">{lead.company_name}</p>
                  </div>
                </div>
              )}

              {/* Source */}
              {lead.source && (
                <div className="flex items-center gap-4 group">
                  <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors shadow-sm">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Source</p>
                    <p className="text-base font-bold text-[#0C4A6E] font-['Poppins',sans-serif]">{lead.source}</p>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* 3. Timeline Section Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Timeline
            </h3>
            <div className="space-y-4">
              {/* Next Follow Up - Highlighted */}
              {lead.follow_up_date && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-gray-600">Next Follow-Up</span>
                  </div>
                  <span className="text-sm font-bold text-orange-600 bg-white px-3 py-1 rounded-lg border border-orange-100 shadow-sm">
                    {formatDateOnly(lead.follow_up_date)}
                  </span>
                </div>
              )}

              {/* Created & Updated - Simple Rows */}
              <div className="flex justify-between items-center px-2">
                <span className="text-sm text-gray-500">Created</span>
                <span className="text-sm font-medium text-gray-800">{formatDate(lead.created_at)}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-sm text-gray-500">Last Updated</span>
                <span className="text-sm font-medium text-gray-800">{formatDate(lead.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* 4. Notes Section */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Notes
              </h3>
              {canEdit && (
                <button onClick={handleEdit} className="text-xs text-[#06B6D4] font-medium hover:underline">
                  Edit Note
                </button>
              )}
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100/50 min-h-[80px]">
              {lead.notes ? (
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{lead.notes}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No notes added yet.</p>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Follow-Ups (Desktop Only) */}
        <div className="hidden lg:flex w-1/2 h-full flex-col overflow-hidden">
          <LeadFollowUps
            leadId={lead.id}
            currentUserId={currentUserId}
            userRole={userRole}
            leadFollowUpDate={lead.follow_up_date}
          />
        </div>

      </div>

      {/* MOBILE ACTION BAR (Sticky Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 p-3 lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)] safe-area-bottom">
        <div className="grid grid-cols-3 gap-3">
          <a
            href={`tel:${lead.phone}`}
            className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-gray-600 hover:bg-gray-50 active:bg-gray-100"
          >
            <div className="h-6 w-6 text-[#06B6D4]">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold">Call</span>
          </a>

          {canEdit && (
            <button
              onClick={handleEdit}
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-gray-600 hover:bg-gray-50 active:bg-gray-100"
            >
              <div className="h-6 w-6 text-[#06B6D4]">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold">Edit</span>
            </button>
          )}

          <button
            onClick={() => setMobileFollowUpsOpen(true)}
            className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-[#06B6D4] text-white shadow-lg active:scale-95 transition-transform"
          >
            <div className="h-6 w-6">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold">Follow-Ups</span>
          </button>
        </div>
      </div>

      {/* MOBILE FOLLOW-UPS SHEET (Overlay) */}
      {mobileFollowUpsOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-gray-900/50 backdrop-blur-sm animate-fade-in">
          <div
            className="absolute inset-0"
            onClick={() => setMobileFollowUpsOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 h-[85vh] bg-[#F8FAFC] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            {/* Sheet Handle & Header */}
            <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-['Poppins',sans-serif] text-lg font-bold text-[#0C4A6E]">Follow-Ups</h3>
              <button
                onClick={() => setMobileFollowUpsOpen(false)}
                className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Follow Ups Component (Reused) */}
            <div className="flex-1 overflow-hidden">
              <LeadFollowUps
                leadId={lead.id}
                currentUserId={currentUserId}
                userRole={userRole}
                leadFollowUpDate={lead.follow_up_date}
                hideHeader={true}
                className="!bg-transparent !shadow-none !border-none !p-0 !rounded-none h-full"
              />
            </div>
          </div>
        </div>
      )}

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

