'use client'

import { useEffect, useState } from 'react'
import type { InvoiceFormData, InvoiceType } from '@/lib/invoices/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import { InvoiceForm } from './invoice-form'

interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialData?: Partial<InvoiceFormData>
  /** Used to force the form to remount when switching records (e.g. edit A -> edit B). */
  formKey?: string
  isLoading?: boolean
  onSubmit: (formData: InvoiceFormData) => Promise<{ data: any; error: string | null }>
  clients: ClientSelectOption[]
  projects: Array<{ id: string; name: string }>
}

export function InvoiceModal({
  isOpen,
  onClose,
  mode,
  initialData,
  formKey,
  isLoading = false,
  onSubmit,
  clients,
  projects,
}: InvoiceModalProps) {
  const [headerInvoiceType, setHeaderInvoiceType] = useState<InvoiceType>(() => initialData?.invoice_type ?? 'gst')

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'unset'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setHeaderInvoiceType(initialData?.invoice_type ?? 'gst')
    }
  }, [isOpen, initialData?.invoice_type])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-5xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-3 items-center border-b border-gray-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-[#1E1B4B]">
              {mode === 'create' ? 'Create New Invoice' : 'Edit Invoice'}
            </h2>
          </div>

          <div className="flex justify-center">
            <div
              className="inline-flex rounded-xl border border-slate-200 bg-white p-1"
              role="group"
              aria-label="Invoice type"
            >
              <button
                type="button"
                onClick={() => setHeaderInvoiceType('gst')}
                disabled={isLoading}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  headerInvoiceType === 'gst'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                GST
              </button>
              <button
                type="button"
                onClick={() => setHeaderInvoiceType('non_gst')}
                disabled={isLoading}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  headerInvoiceType === 'non_gst'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                Non‑GST
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-160px)] overflow-y-auto px-6 py-6">
          <InvoiceForm
            key={formKey ?? mode}
            initialData={initialData}
            onSubmit={onSubmit}
            onSuccess={onClose}
            submitLabel={mode === 'create' ? 'Create Invoice' : 'Update Invoice'}
            disabled={isLoading}
            clients={clients}
            projects={projects}
            invoiceType={headerInvoiceType}
          />
        </div>
      </div>
    </div>
  )
}

