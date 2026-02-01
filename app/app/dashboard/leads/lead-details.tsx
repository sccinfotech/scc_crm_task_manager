'use client'

import { useEffect } from 'react'
import { Lead, LeadStatus } from '@/lib/leads/actions'
import { LeadFollowUps } from './lead-followups'

interface LeadDetailsProps {
  lead: Lead
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  canEdit: boolean
  canDelete: boolean
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

export function LeadDetails({
  lead,
  onClose,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  currentUserId,
  userRole,
}: LeadDetailsProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-600 transition-all hover:bg-cyan-50 hover:text-[#06B6D4]"
            aria-label="Back to list"
          >
            <svg
              className="h-5 w-5 sm:h-6 sm:w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-[#1E1B4B] sm:text-xl">Lead Details</h2>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={onEdit}
              className="rounded-lg p-2.5 text-[#7C3AED] transition-all hover:bg-purple-50 hover:shadow-md"
              aria-label="Edit lead"
              title="Edit Lead"
            >
              <svg
                className="h-5 w-5"
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
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="rounded-lg p-2.5 text-red-600 transition-all hover:bg-red-50 hover:shadow-md"
              aria-label="Delete lead"
              title="Delete Lead"
            >
              <svg
                className="h-5 w-5"
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
          )}
        </div>
      </div>

      {/* Content - Side by Side Layout */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Main Details Section - Left */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:border-r lg:border-gray-200">
          <div className="space-y-4 sm:space-y-6 w-full">
            {/* Name, Company, Phone and Status Card */}
            <div className="bg-white rounded-xl shadow-lg p-5 sm:p-6 border border-gray-100">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-[#06B6D4] to-[#0891b2] flex items-center justify-center shadow-md flex-shrink-0">
                      <span className="text-lg sm:text-xl font-bold text-white">
                        {getInitials(lead.name)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl sm:text-2xl font-bold text-[#1E1B4B]">{lead.name}</h3>
                      {lead.company_name && (
                        <p className="mt-1 text-sm sm:text-base text-gray-600 font-medium">{lead.company_name}</p>
                      )}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-semibold text-[#1E1B4B]">{lead.phone}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(lead.phone)
                              // You could add a toast notification here
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
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              {lead.source && (
                <div className="bg-white rounded-xl shadow-md p-4 sm:p-5 border border-gray-100 hover:shadow-lg transition-shadow">
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
                  <p className="text-sm sm:text-base font-semibold text-[#1E1B4B] mt-1">{lead.source}</p>
                </div>
              )}
              {lead.follow_up_date && (
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl shadow-md p-4 sm:p-5 border border-orange-100 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded bg-orange-100 flex items-center justify-center">
                      <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">
                      Follow-up Date
                    </p>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-orange-600 mt-1">
                    {formatDateOnly(lead.follow_up_date)}
                  </p>
                </div>
              )}
              <div className="bg-white rounded-xl shadow-md p-4 sm:p-5 border border-gray-100 hover:shadow-lg transition-shadow">
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
                <p className="text-sm sm:text-base font-semibold text-[#1E1B4B] mt-1">
                  {formatDate(lead.created_at)}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-md p-4 sm:p-5 border border-gray-100 hover:shadow-lg transition-shadow">
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
                <p className="text-sm sm:text-base font-semibold text-[#1E1B4B] mt-1">
                  {formatDate(lead.updated_at)}
                </p>
              </div>
            </div>

            {/* Notes Card */}
            {lead.notes && (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg p-5 sm:p-6 border border-purple-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-[#7C3AED] flex items-center justify-center">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <h4 className="text-base font-bold text-[#1E1B4B]">Notes</h4>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-100">
                  <p className="whitespace-pre-wrap text-sm sm:text-base text-[#1E1B4B] leading-relaxed">
                    {lead.notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Follow-Ups Section - Right */}
        <div className="w-full lg:w-1/2 overflow-hidden flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 lg:bg-white">
          <LeadFollowUps
            leadId={lead.id}
            currentUserId={currentUserId}
            userRole={userRole}
            leadFollowUpDate={lead.follow_up_date}
          />
        </div>
      </div>
    </div>
  )
}

