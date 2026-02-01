'use client'

import { useActionState } from 'react'
import { LeadFormData, LeadStatus } from '@/lib/leads/actions'

interface LeadFormProps {
  initialData?: Partial<LeadFormData>
  onSubmit: (formData: LeadFormData) => Promise<{ error: string | null }>
  onSuccess?: () => void
  submitLabel?: string
  mode?: 'create' | 'edit'
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
]

export function LeadForm({
  initialData,
  onSubmit,
  onSuccess,
  submitLabel = 'Save Lead',
  mode = 'create',
}: LeadFormProps) {
  const [state, formAction] = useActionState(
    async (_prevState: { error: string | null } | null, formData: FormData) => {
      const followUpDateValue = mode === 'create' ? (formData.get('follow_up_date') as string) : undefined
      const leadData: LeadFormData = {
        name: formData.get('name') as string,
        company_name: formData.get('company_name') as string,
        phone: formData.get('phone') as string,
        source: formData.get('source') as string,
        status: formData.get('status') as LeadStatus,
        follow_up_date: followUpDateValue || undefined,
        notes: formData.get('notes') as string,
      }

      const result = await onSubmit(leadData)
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

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-[#1E1B4B] mb-2">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          defaultValue={initialData?.name || ''}
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20 sm:text-sm"
          placeholder="Enter lead name"
        />
      </div>

      {/* Company Name */}
      <div>
        <label htmlFor="company_name" className="block text-sm font-semibold text-[#1E1B4B] mb-2">
          Company Name
        </label>
        <input
          type="text"
          id="company_name"
          name="company_name"
          defaultValue={initialData?.company_name || ''}
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20 sm:text-sm"
          placeholder="Enter company name"
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-semibold text-[#1E1B4B] mb-2">
          Phone <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          required
          defaultValue={initialData?.phone || ''}
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20 sm:text-sm"
          placeholder="Enter phone number"
        />
      </div>

      {/* Source */}
      <div>
        <label htmlFor="source" className="block text-sm font-semibold text-[#1E1B4B] mb-2">
          Source
        </label>
        <input
          type="text"
          id="source"
          name="source"
          defaultValue={initialData?.source || ''}
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20 sm:text-sm"
          placeholder="e.g., Website, Referral, Cold Call"
        />
      </div>

      {/* Status */}
      <div>
        <label htmlFor="status" className="block text-sm font-semibold text-[#1E1B4B] mb-2">
          Status <span className="text-red-500">*</span>
        </label>
        <select
          id="status"
          name="status"
          required
          defaultValue={initialData?.status || 'new'}
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#1E1B4B] shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20 sm:text-sm"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Next Follow-up Date - Sets lead's next_follow_up_date directly, does NOT create a follow-up record */}
      {mode === 'create' && (
        <div>
          <label htmlFor="follow_up_date" className="block text-sm font-semibold text-[#1E1B4B] mb-2">
            Next Follow-up Date
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Optional: Set the next follow-up date for this lead (does not create a follow-up record)
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
      )}

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-semibold text-[#1E1B4B] mb-2">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={initialData?.notes || ''}
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20 sm:text-sm resize-none"
          placeholder="Enter any additional notes about this lead"
        />
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          className="btn-gradient-smooth w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

