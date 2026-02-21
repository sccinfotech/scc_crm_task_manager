'use client'

import { useEffect, useState } from 'react'

interface UserDeleteModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => Promise<{ error?: string; success?: boolean }>
    userName: string
    isLoading?: boolean
}

export function UserDeleteModal({
    isOpen,
    onClose,
    onConfirm,
    userName,
    isLoading: externalLoading = false,
}: UserDeleteModalProps) {
    const [localLoading, setLocalLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const isLoading = externalLoading || localLoading

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
            setError(null)
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleConfirm = async () => {
        setLocalLoading(true)
        setError(null)
        try {
            const result = await onConfirm()
            if (result.error) {
                setError(result.error)
            } else {
                onClose()
            }
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setLocalLoading(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
        >
            <div
                className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
                        <svg
                            className="h-6 w-6 text-red-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[#1E1B4B]">Delete User</h3>
                        <p className="text-sm text-gray-500">This action cannot be undone.</p>
                    </div>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                    Are you sure you want to delete <span className="font-bold text-[#1E1B4B]">{userName}</span>?
                    This will disable their account access immediately.
                </p>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                        {error}
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-700 hover:shadow-red-700/30 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>Deleting...</span>
                            </>
                        ) : (
                            'Delete User'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
