'use client'

interface AccountingDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  isLoading?: boolean
}

export function AccountingDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isLoading = false,
}: AccountingDeleteModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1E1B4B]">{title}</h2>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
