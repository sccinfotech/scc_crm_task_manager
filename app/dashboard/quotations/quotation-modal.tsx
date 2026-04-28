'use client'

import { useEffect, useState } from 'react'
import { QuotationForm } from './quotation-form'
import type { QuotationFormData } from '@/lib/quotations/actions'
import type { LeadSelectOption } from '@/lib/leads/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'
import { createLead, type LeadFormData } from '@/lib/leads/actions'
import { LeadModal } from '@/app/dashboard/leads/lead-modal'

interface QuotationModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialData?: Partial<QuotationFormData>
  onSubmit: (formData: QuotationFormData) => Promise<{ error: string | null }>
  isLoading?: boolean
  leads: LeadSelectOption[]
  clients: ClientSelectOption[]
  technologyTools: TechnologyTool[]
  technologyToolsError?: string | null
  canCreateLead?: boolean
  onLeadCreated?: (newLeadId: string) => void
  preselectedLeadOrClient?: string | null
  onPreselectedApplied?: () => void
}

export function QuotationModal({
  isOpen,
  onClose,
  mode,
  initialData,
  onSubmit,
  isLoading = false,
  leads,
  clients,
  technologyTools,
  technologyToolsError = null,
  canCreateLead = false,
  onLeadCreated,
  preselectedLeadOrClient,
  onPreselectedApplied,
}: QuotationModalProps) {
  const [createLeadModalOpen, setCreateLeadModalOpen] = useState(false)

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

  const handleCreateLeadSubmit = async (formData: LeadFormData) => {
    const result = await createLead(formData)
    if (!result.error && result.data) {
      onLeadCreated?.(result.data.id)
      setCreateLeadModalOpen(false)
      return { error: null }
    }
    return { error: result.error ?? 'Failed to create lead' }
  }

  if (!isOpen) return null

  return (
    <>
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-3"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 sm:py-3 flex-shrink-0">
          <h2 className="text-lg font-semibold text-[#1E1B4B] sm:text-xl">
            {mode === 'create' ? 'Create Quotation' : 'Edit Quotation'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 flex-1">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-12 rounded-xl bg-gray-200" />
              <div className="h-12 rounded-xl bg-gray-200" />
              <div className="h-32 rounded-xl bg-gray-200" />
            </div>
          ) : (
            <QuotationForm
              initialData={initialData}
              onSubmit={onSubmit}
              submitLabel={mode === 'create' ? 'Create Quotation' : 'Save Changes'}
              mode={mode}
              leads={leads}
              clients={clients}
              technologyTools={technologyTools}
              technologyToolsError={technologyToolsError}
              canCreateLead={canCreateLead}
              onCreateLeadClick={() => setCreateLeadModalOpen(true)}
              preselectedLeadOrClient={preselectedLeadOrClient}
              onPreselectedApplied={onPreselectedApplied}
            />
          )}
        </div>
      </div>
    </div>

    {createLeadModalOpen && (
      <div className="fixed inset-0 z-[70]">
        <LeadModal
          isOpen={true}
          onClose={() => setCreateLeadModalOpen(false)}
          mode="create"
          onSubmit={handleCreateLeadSubmit}
        />
      </div>
    )}
    </>
  )
}
