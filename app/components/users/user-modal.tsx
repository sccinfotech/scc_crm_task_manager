'use client'

import { useEffect } from 'react'
import { UserForm } from '@/app/components/users/user-form'
import {
  UserData,
  CreateUserFormData,
  UpdateUserFormData,
} from '@/lib/users/actions'

interface UserModalProps {
    isOpen: boolean
    onClose: () => void
    mode: 'create' | 'edit'
    initialData?: UserData
    readOnly?: boolean
    onSubmit: (data: CreateUserFormData | UpdateUserFormData) => Promise<{ error?: string; success?: boolean }>
}

export function UserModal({
    isOpen,
    onClose,
    mode,
    initialData,
    readOnly = false,
    onSubmit,
}: UserModalProps) {
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

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
        >
            {/* Modal */}
            <div
                className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-[#1E1B4B]">
                        {mode === 'create' ? 'Create New User' : 'Edit User'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        data-tooltip="Close"
                    >
                        <svg
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto px-6 py-6 flex-1">
                    <UserForm
                        mode={mode}
                        initialData={initialData}
                        onSubmit={onSubmit}
                        onCancel={onClose}
                        readOnly={readOnly}
                    />
                </div>
            </div>
        </div>
    )
}
