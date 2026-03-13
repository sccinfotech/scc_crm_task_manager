'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import { useToast } from '@/app/components/ui/toast-context'
import { EmptyState } from '@/app/components/empty-state'
import { AddPaymentModal } from '../add-payment-modal'
import { EditPaymentModal } from '../edit-payment-modal'
import { AccountingDeleteModal } from '@/app/dashboard/accounting/accounting-delete-modal'
import type { PaymentProjectDetail } from '@/lib/payments/actions'
import type { ProjectRequirement } from '@/lib/projects/requirements-actions'
import type { EntryListItem } from '@/lib/accounting/actions'
import { deleteProjectPayment } from '@/lib/payments/actions'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

type DetailTab = 'requirements' | 'payments'

interface PaymentDetailViewProps {
  detail: PaymentProjectDetail
}

export function PaymentDetailView({ detail }: PaymentDetailViewProps) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const [detailTab, setDetailTab] = useState<DetailTab>('requirements')
  const [addPaymentOpen, setAddPaymentOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<EntryListItem | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<EntryListItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [descriptionModalText, setDescriptionModalText] = useState<string | null>(null)

  const handlePaymentSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  const handleDeleteConfirm = useCallback(async () => {
    if (!entryToDelete) return
    setDeleteLoading(true)
    const result = await deleteProjectPayment(detail.project.id, entryToDelete.id)
    setDeleteLoading(false)
    if (result.error) {
      showError('Delete failed', result.error)
      setEntryToDelete(null)
      return
    }
    showSuccess('Payment deleted', 'Received and outstanding amounts have been updated.')
    setEntryToDelete(null)
    router.refresh()
  }, [entryToDelete, detail.project.id, router, showError, showSuccess])

  const { project, requirements, requirementSummary, paymentHistory, totalAmount, receivedAmount, pendingAmount } = detail

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      {/* 4 views: 1) Client view, 2) Total, 3) Received, 4) Outstanding */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* View 1: Client */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-2 sm:gap-3 min-w-0">
          {project.logo_url ? (
            <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200/80 shadow-sm sm:h-10 sm:w-10">
              <Image
                src={project.logo_url}
                alt={project.name}
                fill
                className="object-contain p-0.5"
                sizes="40px"
              />
            </span>
          ) : (
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-sm flex-shrink-0 ring-2 ring-white">
              {project.name?.trim()[0]?.toUpperCase() ?? 'P'}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <h2
              className="text-sm sm:text-base font-bold text-[#1E1B4B] truncate"
              title={project.name}
            >
              {project.name}
            </h2>
            <p className="text-xs text-slate-600 truncate">
              {project.client_name || project.client_company_name || '—'}
            </p>
          </div>
        </div>
        {/* View 2: Total */}
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex flex-col justify-center">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">Total</p>
          <p className="text-base sm:text-lg font-bold text-[#1E1B4B]">{formatCurrency(totalAmount)}</p>
        </div>
        {/* View 3: Received */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 flex flex-col justify-center">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-700">Received</p>
          <p className="text-base sm:text-lg font-bold text-emerald-800">{formatCurrency(receivedAmount)}</p>
        </div>
        {/* View 4: Outstanding */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 flex flex-col justify-center">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-700">Outstanding</p>
          <p className="text-base sm:text-lg font-bold text-amber-800">{formatCurrency(pendingAmount)}</p>
        </div>
      </div>

      {/* Tab bar – same style as Project detail page; Add Payment inline on the right */}
      <div className="flex-shrink-0 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-stretch overflow-x-auto scrollbar-hide" role="tablist" aria-label="Payment detail tabs">
            {[
              { id: 'requirements' as const, label: 'Requirements' },
              { id: 'payments' as const, label: 'Payment history' },
            ].map(({ id, label }, index) => {
              const isActive = detailTab === id
              const isLast = index === 1
              return (
                <div key={id} className="flex items-stretch">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setDetailTab(id)}
                    className={`
                      relative px-2.5 pb-2 pt-1 text-sm font-semibold whitespace-nowrap transition-colors duration-200 cursor-pointer
                      border-b-2
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white
                      ${isActive
                        ? 'text-[#06B6D4] border-[#06B6D4]'
                        : 'text-slate-600 border-transparent hover:text-slate-800'}
                    `}
                  >
                    {label}
                  </button>
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className="mx-2 w-px self-stretch bg-gradient-to-b from-slate-200/0 via-slate-200/70 to-slate-200/0 sm:mx-3"
                    />
                  )}
                </div>
              )
            })}
          </div>
          {detailTab === 'payments' && (
            <button
              type="button"
              onClick={() => setAddPaymentOpen(true)}
              disabled={pendingAmount <= 0}
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Payment
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-slate-200 bg-white flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto min-h-0 p-3">
          {detailTab === 'requirements' && (
            <>
              {requirements.length === 0 ? (
                <p className="text-sm text-slate-500">No requirements recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Index</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Description</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Type</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {requirements.map((req: ProjectRequirement, index: number) => {
                        const desc = (req.description || '').trim() || 'No description'
                        return (
                          <tr key={req.id}>
                            <td className="py-1.5 pr-3 text-sm text-slate-700">{index + 1}</td>
                            <td className="py-1.5 pr-3 text-sm text-slate-700 max-w-[280px] sm:max-w-[360px]">
                              <button
                                type="button"
                                onClick={() => setDescriptionModalText(desc)}
                                className="flex w-full items-start gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-slate-50"
                                aria-label="View full description"
                              >
                                <span className="line-clamp-2 whitespace-pre-line break-words flex-1 min-w-0">
                                  {desc}
                                </span>
                              </button>
                            </td>
                            <td className="py-1.5 pr-3 text-sm text-slate-700">{req.requirement_type === 'addon' ? 'Add-on' : 'Initial'}</td>
                            <td className="py-1.5 text-sm font-semibold text-cyan-700 text-right">{formatCurrency(req.amount ?? 0)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {detailTab === 'payments' && (
            <>
              {paymentHistory.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center pt-16 pb-8">
                  <EmptyState
                    title="No payments yet"
                    description="Use Add Payment to record the first payment for this project."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Account</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Amount</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {paymentHistory.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/50">
                          <td className="py-1.5 pr-3 text-sm text-slate-700">{formatDate(entry.entry_date)}</td>
                          <td className="py-1.5 pr-3 text-sm text-slate-700">{entry.account_name}</td>
                          <td className="py-1.5 text-sm font-semibold text-emerald-700 text-right">{formatCurrency(entry.amount)}</td>
                          <td className="py-1.5 pl-2 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={() => setEditingEntry(entry)}
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                aria-label="Edit payment"
                              >
                                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEntryToDelete(entry)}
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                aria-label="Delete payment"
                              >
                                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {addPaymentOpen && (
        <AddPaymentModal
          isOpen={addPaymentOpen}
          onClose={() => setAddPaymentOpen(false)}
          project={{
            id: project.id,
            name: project.name,
            pending_amount: pendingAmount,
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {editingEntry && (
        <EditPaymentModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          project={{ id: project.id, name: project.name }}
          entry={editingEntry}
          pendingAmount={pendingAmount}
          onSuccess={() => {
            setEditingEntry(null)
            handlePaymentSuccess()
          }}
        />
      )}

      <AccountingDeleteModal
        isOpen={!!entryToDelete}
        onClose={() => setEntryToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete payment"
        message="Are you sure you want to delete this payment? Received and outstanding amounts will be updated."
        isLoading={deleteLoading}
      />

      {/* Description full-text modal */}
      {descriptionModalText !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Full description">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDescriptionModalText(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Description</h3>
              <button
                type="button"
                onClick={() => setDescriptionModalText(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-slate-700 whitespace-pre-line break-words">{descriptionModalText}</p>
            </div>
            <div className="border-t border-slate-200 px-4 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setDescriptionModalText(null)}
                className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
