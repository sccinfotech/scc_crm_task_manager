'use client'

import { useEffect, useState } from 'react'
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
    new: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    contacted: 'bg-purple-100 text-purple-700 border-purple-200',
    follow_up: 'bg-purple-200 text-purple-800 border-purple-300',
    converted: 'bg-green-100 text-green-700 border-green-200',
    lost: 'bg-red-100 text-red-700 border-red-200',
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
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  )
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
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

function IconButton({
  icon,
  onClick,
  label,
  color = 'gray',
  className = '',
}: {
  icon: React.ReactNode
  onClick?: () => void
  label: string
  color?: 'gray' | 'green' | 'red' | 'blue' | 'purple'
  className?: string
}) {
  const colorClasses = {
    gray: 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
    green: 'text-gray-500 hover:bg-green-100 hover:text-green-600',
    red: 'text-gray-500 hover:bg-red-100 hover:text-red-600',
    blue: 'text-gray-500 hover:bg-blue-100 hover:text-blue-600',
    purple: 'text-gray-500 hover:bg-purple-100 hover:text-purple-600',
  }

  return (
    <button
      onClick={onClick}
      className={`group relative rounded-lg p-2 transition-all ${colorClasses[color]} ${className}`}
      aria-label={label}
    >
      {icon}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {label}
      </span>
    </button>
  )
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
  const [showNotesEdit, setShowNotesEdit] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(lead.phone)
    // You could add a toast notification here
  }

  const handleCall = () => {
    window.location.href = `tel:${lead.phone}`
  }

  const handleSMS = () => {
    window.location.href = `sms:${lead.phone}`
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F5F3FF]">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <IconButton
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            }
            onClick={onClose}
            label="Back to list"
            color="gray"
          />
          <h2 className="text-lg font-bold text-[#1E1B4B]">Lead Details</h2>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <IconButton
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              }
              onClick={onEdit}
              label="Edit Lead"
              color="purple"
            />
          )}
          {canDelete && (
            <IconButton
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              }
              onClick={onDelete}
              label="Delete Lead"
              color="red"
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Left Section - Lead Info */}
        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6 lg:border-r lg:border-gray-200 bg-[#F5F3FF]">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Lead Profile Card */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-4 flex-1">
                  {/* Avatar */}
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#06B6D4] to-[#0891b2] flex items-center justify-center shadow-lg flex-shrink-0">
                    <span className="text-2xl font-bold text-white">
                      {getInitials(lead.name)}
                    </span>
                  </div>
                  
                  {/* Name & Company */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-[#1E1B4B] mb-1">{lead.name}</h1>
                    {lead.company_name && (
                      <p className="text-base text-gray-600 font-medium mb-4">{lead.company_name}</p>
                    )}
                    
                    {/* Phone with Actions */}
                    <div className="flex items-center gap-3">
                      <span className="text-base font-semibold text-[#1E1B4B]">{lead.phone}</span>
                      <div className="flex items-center gap-1">
                        <IconButton
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          }
                          onClick={handleCopyPhone}
                          label="Copy Phone"
                          color="gray"
                        />
                        <IconButton
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          }
                          onClick={handleCall}
                          label="Call"
                          color="green"
                        />
                        <IconButton
                          icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                          }
                          onClick={handleSMS}
                          label="Send SMS"
                          color="blue"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Status Badge - Top Right */}
                <div className="flex-shrink-0">
                  <StatusPill status={lead.status} />
                </div>
              </div>
            </div>

            {/* Meta Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Source Card */}
              {lead.source && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Source</p>
                      <p className="text-base font-bold text-[#1E1B4B]">{lead.source}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Follow-up Date Card */}
              {lead.follow_up_date && (
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl shadow-sm border border-orange-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-orange-700 mb-1">Next Follow-Up</p>
                      <p className="text-base font-bold text-orange-600">{formatDateOnly(lead.follow_up_date)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Created Date Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Created</p>
                    <p className="text-base font-semibold text-[#1E1B4B]">{formatDate(lead.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Last Updated Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Last Updated</p>
                    <p className="text-base font-semibold text-[#1E1B4B]">{formatDate(lead.updated_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Card */}
            {lead.notes && (
              <div 
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow relative group"
                onMouseEnter={() => setShowNotesEdit(true)}
                onMouseLeave={() => setShowNotesEdit(false)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[#1E1B4B]">Notes</h3>
                  </div>
                  {canEdit && showNotesEdit && (
                    <IconButton
                      icon={
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      }
                      onClick={onEdit}
                      label="Edit Notes"
                      color="purple"
                    />
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="whitespace-pre-wrap text-sm text-[#1E1B4B] leading-relaxed">
                    {lead.notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section - Follow-Ups */}
        <div className="w-full lg:w-96 xl:w-[420px] overflow-hidden flex flex-col bg-white border-l border-gray-200 shadow-lg">
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
