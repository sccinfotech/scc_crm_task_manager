'use client'

interface StatusConfirmModalProps {
  isOpen: boolean
  userName: string
  nextActive: boolean
  isLoading?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function StatusConfirmModal({
  isOpen,
  userName,
  nextActive,
  isLoading = false,
  onClose,
  onConfirm,
}: StatusConfirmModalProps) {
  if (!isOpen) return null

  const actionLabel = nextActive ? 'Activate' : 'Deactivate'

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">{actionLabel} user?</h3>
        </div>
        <div className="px-5 py-4 text-sm text-gray-700">
          Are you sure you want to {actionLabel.toLowerCase()} <span className="font-semibold">{userName}</span>?
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              nextActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {isLoading ? 'Saving...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

