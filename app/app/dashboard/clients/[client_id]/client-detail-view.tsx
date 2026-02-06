'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Tooltip } from '@/app/components/ui/tooltip'
import { Client, ClientStatus, getClient, updateClient, deleteClient, ClientFormData } from '@/lib/clients/actions'
import { ClientFollowUps } from '../client-followups'
import { ClientModal } from '../client-modal'
import { DeleteConfirmModal } from '../delete-confirm-modal'
import { InternalNotesPanel } from '../internal-notes-panel'

interface ClientDetailViewProps {
  client: Client
  canWrite: boolean
  canManageInternalNotes: boolean
}

function StatusPill({ status }: { status: ClientStatus }) {
  const statusStyles = {
    active: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200',
    inactive: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200',
  }

  const statusLabels = {
    active: 'Active',
    inactive: 'Inactive',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border transition-all duration-200 ${statusStyles[status]}`}
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

export function ClientDetailView({
  client: initialClient,
  canWrite,
  canManageInternalNotes,
}: ClientDetailViewProps) {
  const router = useRouter()
  const [client, setClient] = useState<Client>(initialClient)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mobileFollowUpsOpen, setMobileFollowUpsOpen] = useState(false)
  const [internalNotesOpen, setInternalNotesOpen] = useState(false)

  const canEdit = canWrite
  const canDelete = canWrite
  const mobileActionCount = 2 + (canEdit ? 1 : 0) + (canManageInternalNotes ? 1 : 0)
  const mobileGridClass =
    mobileActionCount === 4 ? 'grid-cols-4' : mobileActionCount === 3 ? 'grid-cols-3' : 'grid-cols-2'

  const handleBack = () => {
    router.push('/dashboard/clients')
  }

  const handleEdit = () => {
    setEditModalOpen(true)
  }

  const handleEditSuccess = async () => {
    // Refresh client data after edit
    setLoading(true)
    const result = await getClient(client.id)
    setLoading(false)
    if (result && 'data' in result && result.data) {
      setClient(result.data as Client)
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
    const result = await deleteClient(client.id)
    setDeleting(false)

    if (!result.error) {
      router.push('/dashboard/clients')
    } else {
      alert(result.error || 'Failed to delete client')
      setDeleteModalOpen(false)
    }
  }

  const handleCloseDelete = () => {
    setDeleteModalOpen(false)
  }

  const getInitialEditData = (): ClientFormData => {
    return {
      name: client.name,
      company_name: client.company_name || undefined,
      phone: client.phone,
      email: client.email || undefined,
      status: client.status,
      remark: client.remark || undefined,
    }
  }

  return (
    <>
      <div className="flex h-full flex-col lg:flex-row gap-4">

        {/* LEFT COLUMN: Client Details (Full width on mobile, 50% on desktop) */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4 overflow-y-auto pb-24 lg:pb-0 scrollbar-hide">

          {/* Main Card */}
          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 relative">

            {/* 1. Header Section */}
            <div className="relative bg-white border-b border-gray-100 p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-5">
                  {/* Avatar */}
                  <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                    <span className="text-3xl font-extrabold text-white drop-shadow-sm">
                      {getInitials(client.name)}
                    </span>
                    <div className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-white shadow-sm ${client.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} title={`Client is ${client.status}`}></div>
                  </div>

                  {/* Name & Status */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
                        {client.name}
                      </h1>
                      <StatusPill status={client.status} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-slate-500 font-medium text-sm">
                      {client.company_name && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {client.company_name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Added {formatDateOnly(client.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop Actions */}
                <div className="hidden lg:flex items-center gap-2">
                  {canManageInternalNotes && (
                    <Tooltip content="Internal notes">
                      <button
                        onClick={() => setInternalNotesOpen(true)}
                        className="p-2.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all duration-200 active:scale-95 border border-transparent hover:border-cyan-100"
                      >
                        <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 4h8m-8 4h6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H9l-4 4V7a2 2 0 012-2z" />
                        </svg>
                      </button>
                    </Tooltip>
                  )}
                  {canEdit && (
                    <Tooltip content="Edit client details">
                      <button
                        onClick={handleEdit}
                        className="p-2.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all duration-200 active:scale-95 border border-transparent hover:border-cyan-100"
                      >
                        <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </Tooltip>
                  )}
                  <div className="h-6 w-px bg-slate-200 mx-1"></div>
                  <Tooltip content="Copy phone number">
                    <button
                      onClick={() => navigator.clipboard.writeText(client.phone)}
                      className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 active:scale-95 border border-transparent hover:border-blue-100"
                    >
                      <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </button>
                  </Tooltip>
                  {canDelete && (
                    <Tooltip content="Delete client">
                      <button
                        onClick={handleDelete}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200 active:scale-95 border border-transparent hover:border-rose-100"
                      >
                        <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Contact Details (Line-wise Layout) */}
            <div className="p-6 bg-slate-50/30 flex flex-col gap-4 rounded-b-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Phone */}
                <div className="flex items-center gap-4 group p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-sm hover:border-cyan-100 transition-all cursor-pointer" onClick={() => window.location.href = `tel:${client.phone}`}>
                  <div className="h-12 w-12 rounded-xl bg-cyan-50 flex items-center justify-center text-[#06B6D4] group-hover:bg-[#06B6D4] group-hover:text-white transition-colors shadow-sm">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Direct Contact</p>
                    <p className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">{client.phone}</p>
                  </div>
                </div>

                {/* Email */}
                {client.email && (
                  <div className="flex items-center gap-4 group p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-sm hover:border-blue-100 transition-all cursor-pointer" onClick={() => window.location.href = `mailto:${client.email}`}>
                    <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors shadow-sm">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</p>
                      <p className="text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] truncate">{client.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* 3. Notes Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Remark
              </h3>
              {canEdit && (
                <button onClick={handleEdit} className="text-xs text-[#06B6D4] font-medium hover:underline">
                  Edit Remark
                </button>
              )}
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100/50 min-h-[80px]">
              {client.remark ? (
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{client.remark}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No remark added yet.</p>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Follow-Ups (Desktop Only) */}
        <div className="hidden lg:flex w-1/2 h-full flex-col">
          <ClientFollowUps
            clientId={client.id}
            leadId={client.lead_id}
            canWrite={canWrite}
          />
        </div>

      </div>

      {/* MOBILE ACTION BAR (Sticky Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 p-3 lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)] safe-area-bottom">
        <div className={`grid gap-3 ${mobileGridClass}`}>
          <a
            href={`tel:${client.phone}`}
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

          {canManageInternalNotes && (
            <button
              onClick={() => setInternalNotesOpen(true)}
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-gray-600 hover:bg-gray-50 active:bg-gray-100"
            >
              <div className="h-6 w-6 text-[#06B6D4]">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 4h8m-8 4h6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H9l-4 4V7a2 2 0 012-2z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold">Notes</span>
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
              <ClientFollowUps
                clientId={client.id}
                leadId={client.lead_id}
                canWrite={canWrite}
                hideHeader={true}
                className="!bg-transparent !shadow-none !border-none !p-0 !rounded-none h-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <ClientModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          mode="edit"
          initialData={getInitialEditData()}
          onSubmit={async (formData: ClientFormData) => {
            const result = await updateClient(client.id, formData)
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
          clientName={client.name}
          isLoading={deleting}
        />
      )}

      {canManageInternalNotes && (
        <InternalNotesPanel
          clientId={client.id}
          clientName={client.name}
          isOpen={internalNotesOpen}
          onClose={() => setInternalNotesOpen(false)}
        />
      )}
    </>
  )
}
