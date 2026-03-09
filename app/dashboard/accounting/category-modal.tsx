'use client'

import { useEffect, useState } from 'react'
import type { CategoryFormData, CategoryType, CategoryStatus } from '@/lib/accounting/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'

const TYPE_OPTIONS: { value: CategoryType; label: string }[] = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

const STATUS_OPTIONS: { value: CategoryStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialData?: Partial<CategoryFormData>
  isLoading?: boolean
  onSubmit: (form: CategoryFormData) => Promise<{ error: string | null }>
}

export function CategoryModal({
  isOpen,
  onClose,
  mode,
  initialData,
  isLoading = false,
  onSubmit,
}: CategoryModalProps) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [type, setType] = useState<CategoryType>(initialData?.type ?? 'expense')
  const [status, setStatus] = useState<CategoryStatus>(initialData?.status ?? 'active')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setName(initialData?.name ?? '')
    setType(initialData?.type ?? 'expense')
    setStatus(initialData?.status ?? 'active')
    setError(null)
  }, [isOpen, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Category name is required.')
      return
    }
    setSubmitting(true)
    const result = await onSubmit({ name: name.trim(), type, status })
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1E1B4B]">{mode === 'create' ? 'Add Category' : 'Edit Category'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-[#1E1B4B] mb-1">Category Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#06B6D4] focus:ring-2 focus:ring-[#06B6D4]/20"
              placeholder="e.g. Sales, Rent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E1B4B] mb-1">Type *</label>
            <ListboxDropdown value={type} options={TYPE_OPTIONS} onChange={(v) => setType(v as CategoryType)} ariaLabel="Category type" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E1B4B] mb-1">Status</label>
            <ListboxDropdown value={status} options={STATUS_OPTIONS} onChange={(v) => setStatus(v as CategoryStatus)} ariaLabel="Status" />
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
