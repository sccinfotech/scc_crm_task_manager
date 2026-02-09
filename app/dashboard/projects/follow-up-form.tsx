'use client'

import { useActionState } from 'react'
import { ProjectFollowUpFormData } from '@/lib/projects/actions'

interface FollowUpFormProps {
  initialData?: Partial<ProjectFollowUpFormData>
  onSubmit: (formData: ProjectFollowUpFormData) => Promise<{ error: string | null }>
  onSuccess?: () => void
  submitLabel?: string
}

export function FollowUpForm({
  initialData,
  onSubmit,
  onSuccess,
  submitLabel = 'Save Follow-Up',
}: FollowUpFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: { error: string | null } | null, formData: FormData) => {
      const followUpData: ProjectFollowUpFormData = {
        follow_up_date: (formData.get('follow_up_date') as string) || undefined,
        note: (formData.get('note') as string) || undefined,
      }

      const result = await onSubmit(followUpData)
      if (!result.error && onSuccess) {
        onSuccess()
      }
      return result
    },
    null
  )

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-medium text-red-800">{state.error}</p>
        </div>
      )}

      {/* Note - What happened in this follow-up */}
      <div>
        <label htmlFor="note" className="block text-sm font-semibold text-[#1E1B4B] mb-2">
          Follow-Up Note (Optional)
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Describe what was discussed or what action was taken during this follow-up. You can add a note or set a reminder date (at least one is required).
        </p>
        <textarea
          id="note"
          name="note"
          rows={6}
          defaultValue={initialData?.note || ''}
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20 sm:text-sm resize-none"
          placeholder="Enter what was discussed or what action was taken..."
        />
      </div>

      {/* Set Reminder - Optional next follow-up date (same as client) */}
      <div>
        <label
          htmlFor="follow_up_date"
          className="block text-sm font-semibold text-[#1E1B4B] mb-2"
        >
          Set Reminder (Optional)
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Optionally set a date for the next follow-up reminder
        </p>
        <input
          type="date"
          id="follow_up_date"
          name="follow_up_date"
          defaultValue={
            initialData?.follow_up_date
              ? new Date(initialData.follow_up_date).toISOString().slice(0, 10)
              : ''
          }
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20 sm:text-sm"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="btn-gradient-smooth rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {isPending ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
