'use client'

import { useEffect, useState } from 'react'
import type { EntryFormData, EntryType } from '@/lib/accounting/actions'
import type { AccountSelectOption, CategorySelectOption } from '@/lib/accounting/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'

const ENTRY_TYPE_OPTIONS: { value: EntryType; label: string }[] = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

interface EntryModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialEntryType?: EntryType
  initialData?: Partial<EntryFormData>
  accounts: AccountSelectOption[]
  categories: CategorySelectOption[]
  isLoading?: boolean
  onSubmit: (form: EntryFormData) => Promise<{ error: string | null }>
}

export function EntryModal({
  isOpen,
  onClose,
  mode,
  initialEntryType = 'income',
  initialData,
  accounts,
  categories,
  isLoading = false,
  onSubmit,
}: EntryModalProps) {
  const [entry_type, setEntryType] = useState<EntryType>(initialData?.entry_type ?? initialEntryType)
  const [account_id, setAccountId] = useState(initialData?.account_id ?? '')
  const [category_id, setCategoryId] = useState(initialData?.category_id ?? '')
  const [amount, setAmount] = useState(initialData?.amount != null ? String(initialData.amount) : '')
  const [entry_date, setEntryDate] = useState(initialData?.entry_date ?? new Date().toISOString().slice(0, 10))
  const [remarks, setRemarks] = useState(initialData?.remarks ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filteredCategories = entry_type ? categories.filter((c) => c.type === entry_type) : categories

  useEffect(() => {
    if (!isOpen) return
    setEntryType(initialData?.entry_type ?? initialEntryType)
    setAccountId(initialData?.account_id ?? '')
    setCategoryId(initialData?.category_id ?? '')
    setAmount(initialData?.amount != null ? String(initialData.amount) : '')
    setEntryDate(initialData?.entry_date ?? new Date().toISOString().slice(0, 10))
    setRemarks(initialData?.remarks ?? '')
    setError(null)
  }, [isOpen, initialData, initialEntryType])

  useEffect(() => {
    setCategoryId('')
  }, [entry_type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const amt = Number(amount)
    if (!account_id || !category_id || !entry_date) {
      setError('Account, category and date are required.')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Amount must be a positive number.')
      return
    }
    setSubmitting(true)
    const result = await onSubmit({
      entry_type,
      account_id,
      category_id,
      amount: amt,
      entry_date,
      remarks: remarks.trim() || null,
    })
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onClose()
  }

  if (!isOpen) return null

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }))
  const categoryOptions = filteredCategories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1E1B4B]">
            {mode === 'create' ? (entry_type === 'income' ? 'Add Income' : 'Add Expense') : 'Edit Entry'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-[#1E1B4B] mb-1">Type</label>
            <ListboxDropdown
              value={entry_type}
              options={ENTRY_TYPE_OPTIONS}
              onChange={(v) => setEntryType(v as EntryType)}
              ariaLabel="Entry type"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E1B4B] mb-1">Account *</label>
            <ListboxDropdown
              value={account_id}
              options={[{ value: '', label: 'Select account' }, ...accountOptions]}
              onChange={setAccountId}
              ariaLabel="Account"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E1B4B] mb-1">Category *</label>
            <ListboxDropdown
              value={category_id}
              options={[{ value: '', label: 'Select category' }, ...categoryOptions]}
              onChange={setCategoryId}
              ariaLabel="Category"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E1B4B] mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
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
              value={entry_date}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#06B6D4] focus:ring-2 focus:ring-[#06B6D4]/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E1B4B] mb-1">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#06B6D4] focus:ring-2 focus:ring-[#06B6D4]/20"
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isLoading || submitting} className="rounded-lg bg-[#06B6D4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0891b2] disabled:opacity-50">
              {mode === 'create' ? 'Create' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
