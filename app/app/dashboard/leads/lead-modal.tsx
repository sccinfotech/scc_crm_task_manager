'use client'

import { useEffect } from 'react'
import { LeadForm } from './lead-form'
import { LeadFormData } from '@/lib/leads/actions'

interface LeadModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialData?: Partial<LeadFormData>
  onSubmit: (formData: LeadFormData) => Promise<{ error: string | null }>
}

export function LeadModal({
  isOpen,
  onClose,
  mode,
  initialData,
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1E1B4B]">
            {mode === 'create' ? 'Create New Lead' : 'Edit Lead'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
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
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-6">
          <LeadForm
            initialData={initialData}
            onSubmit={onSubmit}
            onSuccess={handleSuccess}
            submitLabel={mode === 'create' ? 'Create Lead' : 'Update Lead'}
            mode={mode}
          />
        </div>
      </div>
    </div>
  )
}

