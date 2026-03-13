'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/components/ui/toast-context'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import {
  getPaymentModuleAccounts,
  createProjectPayment,
  type PaymentProjectListItem,
} from '@/lib/payments/actions'

interface AddPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  project: Pick<PaymentProjectListItem, 'id' | 'name' | 'pending_amount'>
  onSuccess: () => void
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function AddPaymentModal({ isOpen, onClose, project, onSuccess }: AddPaymentModalProps) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setAmount('')
    setEntryDate(new Date().toISOString().slice(0, 10))
    setLoadingAccounts(true)
    getPaymentModuleAccounts()
      .then((res) => {
        if (res.error) {
          setError(res.error)
          setAccounts([])
          setDefaultAccountId(null)
          setAccountId('')
          return
        }
        setAccounts((res.data ?? []).map((a) => ({ id: a.id, name: a.name })))
        setDefaultAccountId(res.defaultAccountId)
        setAccountId(res.defaultAccountId ?? '')
      })
      .finally(() => setLoadingAccounts(false))
  }, [isOpen, project.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!accountId.trim()) {
      setError('Please select an account.')
      return
    }
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Amount must be a positive number.')
      return
    }
    if (amt > project.pending_amount) {
      setError(`Amount cannot exceed pending balance (${formatCurrency(project.pending_amount)}).`)
      return
    }
    setSubmitting(true)
    const result = await createProjectPayment(project.id, {
      account_id: accountId,
      amount: amt,
      entry_date: entryDate,
    })
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    showSuccess('Payment recorded', 'The payment has been added and will appear in Accounting.')
    onClose()
    onSuccess()
    router.refresh()
  }

  if (!isOpen) return null

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1E1B4B]">Add Payment — {project.name}</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-slate-500">Pending balance: {formatCurrency(project.pending_amount)}</p>
          <div>
            <label className="block text-sm font-medium text-[#1E1B4B] mb-1">Account *</label>
            {loadingAccounts ? (
              <p className="text-sm text-slate-500">Loading accounts…</p>
            ) : (
              <ListboxDropdown
                value={accountId}
                options={[{ value: '', label: 'Select account' }, ...accountOptions]}
                onChange={setAccountId}
                ariaLabel="Account"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E1B4B] mb-1">Amount *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#06B6D4] focus:ring-2 focus:ring-[#06B6D4]/20"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E1B4B] mb-1">Date *</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#06B6D4] focus:ring-2 focus:ring-[#06B6D4]/20"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting || loadingAccounts} className="rounded-xl bg-[#06B6D4] px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-[#0891b2] disabled:opacity-50">
              {submitting ? 'Saving…' : 'Add Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
