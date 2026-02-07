'use client'

import { useEffect } from 'react'
import { useActionState } from 'react'
import { TechnologyToolFormData } from '@/lib/settings/technology-tools-actions'

interface TechnologyToolModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialData?: Partial<TechnologyToolFormData>
  onSubmit: (formData: TechnologyToolFormData) => Promise<{ error: string | null }>
}

export function TechnologyToolModal({
  isOpen,
  onClose,
  mode,
  initialData,
  onSubmit,
}: TechnologyToolModalProps) {
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

  const [state, formAction, isPending] = useActionState(
    async (_prevState: { error: string | null } | null, formData: FormData) => {
      const toolData: TechnologyToolFormData = {
        name: (formData.get('name') as string) || '',
        is_active: formData.get('is_active') === 'on',
      }
      const result = await onSubmit(toolData)
      if (!result.error) {
        onClose()
      }
      return result
    },
    null
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1E1B4B]">
            {mode === 'create' ? 'Add Technology Tool' : 'Edit Technology Tool'}
          </h2>
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

        <div className="px-6 py-6">
          {state?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
              <p className="text-sm font-medium text-red-800">{state.error}</p>
            </div>
          )}

          <form action={formAction} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-[#1E1B4B] mb-2">
                Tool Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={initialData?.name || ''}
                className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20 sm:text-sm"
                placeholder="React, Figma, Notion"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                defaultChecked={initialData?.is_active ?? true}
                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="submit"
                disabled={isPending}
                className="btn-gradient-smooth rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Saving...' : mode === 'create' ? 'Add Tool' : 'Update Tool'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
