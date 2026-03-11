'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import { AddPaymentModal } from '../add-payment-modal'
import type { PaymentProjectDetail } from '@/lib/payments/actions'
import type { ProjectRequirement } from '@/lib/projects/requirements-actions'

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

interface PaymentDetailViewProps {
  detail: PaymentProjectDetail
}

export function PaymentDetailView({ detail }: PaymentDetailViewProps) {
  const router = useRouter()
  const [addPaymentOpen, setAddPaymentOpen] = useState(false)

  const handlePaymentSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  const { project, requirements, requirementSummary, paymentHistory, totalAmount, receivedAmount, pendingAmount, paymentsCount } = detail

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto">
      {/* Project header */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {project.logo_url ? (
            <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200/80 shadow-sm sm:h-12 sm:w-12">
              <Image
                src={project.logo_url}
                alt={project.name}
                fill
                className="object-contain p-0.5"
                sizes="48px"
              />
            </span>
          ) : (
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm sm:text-lg font-bold text-white shadow-sm flex-shrink-0 ring-2 ring-white">
              {project.name?.trim()[0]?.toUpperCase() ?? 'P'}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <h2
              className="text-base sm:text-lg font-bold text-[#1E1B4B] truncate"
              title={project.name}
            >
              {project.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 truncate">
              {project.client_name || project.client_company_name || '—'}
            </p>
          </div>
        </div>
      </div>
      </div>

      {/* Outstanding summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Amount</p>
          <p className="mt-2 text-xl font-bold text-[#1E1B4B]">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Received</p>
          <p className="mt-2 text-xl font-bold text-emerald-800">{formatCurrency(receivedAmount)}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Outstanding</p>
          <p className="mt-2 text-xl font-bold text-amber-800">{formatCurrency(pendingAmount)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payments received</p>
          <p className="mt-2 text-xl font-bold text-slate-800">{paymentsCount}</p>
        </div>
      </div>

      {/* Requirements list */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Requirements</h3>
        {requirements.length === 0 ? (
          <p className="text-sm text-slate-500">No requirements recorded.</p>
        ) : (
          <ul className="space-y-2">
            {requirements.map((req: ProjectRequirement) => (
              <li key={req.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                <span className="text-sm text-slate-700 line-clamp-1">
                  {(req.description || '').trim() || 'Untitled requirement'}
                </span>
                <span className="text-sm font-semibold text-cyan-700">{formatCurrency(req.amount ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold">
          <span className="text-slate-600">Total (requirements)</span>
          <span className="text-[#1E1B4B]">{formatCurrency(requirementSummary.totalAmount)}</span>
        </div>
      </div>

      {/* Payment history + Add Payment */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex-1 min-h-0 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Payment history</h3>
          <button
            type="button"
            onClick={() => setAddPaymentOpen(true)}
            disabled={pendingAmount <= 0}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Payment
          </button>
        </div>
        {paymentHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto flex-1 min-h-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Account</th>
                  <th className="pb-2 pr-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2 pr-4 text-sm text-slate-700">{formatDate(entry.entry_date)}</td>
                    <td className="py-2 pr-4 text-sm text-slate-700">{entry.account_name}</td>
                    <td className="py-2 text-sm font-semibold text-emerald-700 text-right">{formatCurrency(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
    </div>
  )
}
