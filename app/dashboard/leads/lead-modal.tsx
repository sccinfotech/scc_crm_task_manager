'use client'

import { useEffect } from 'react'
import { LeadForm } from './lead-form'
import { LeadFormData } from '@/lib/leads/actions'

interface LeadModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialData?: Partial<LeadFormData>
  isLoading?: boolean
  onSubmit: (formData: LeadFormData) => Promise<{ error: string | null }>
}

export function LeadModal({
  isOpen,
  onClose,
  mode,
  initialData,
  isLoading = false,
  onSubmit,
}: LeadModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSuccess = () => {
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-3"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop - does not close modal; use Cancel/Close button */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 sm:py-3">
          <h2 className="text-lg font-semibold text-[#1E1B4B] sm:text-xl">
            {mode === 'create' ? 'Create New Lead' : 'Edit Lead'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            data-tooltip="Close"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          {mode === 'edit' && isLoading ? (
            <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading lead details">
              <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="h-12 rounded-xl bg-gray-200" />
                  <div className="h-12 rounded-xl bg-gray-200" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="h-12 rounded-xl bg-gray-200" />
                  <div className="h-12 rounded-xl bg-gray-200" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <div className="h-10 w-20 rounded-xl bg-gray-200" />
                <div className="h-10 w-24 rounded-xl bg-gray-200" />
              </div>
            </div>
          ) : (
            <LeadForm
              initialData={initialData}
              onSubmit={onSubmit}
              onSuccess={handleSuccess}
              submitLabel={mode === 'create' ? 'Create Lead' : 'Update Lead'}
              mode={mode}
            />
          )}
        </div>
      </div>
    </div>
  )
}

