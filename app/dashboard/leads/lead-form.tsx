'use client'

import { useActionState, useState } from 'react'
import { LeadFormData, LeadStatus } from '@/lib/leads/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'

interface LeadFormProps {
  initialData?: Partial<LeadFormData>
  onSubmit: (formData: LeadFormData) => Promise<{ error: string | null }>
  onSuccess?: () => void
  submitLabel?: string
  mode?: 'create' | 'edit'
}

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-purple-500' },
  { value: 'follow_up', label: 'Follow Up', color: 'bg-orange-500' },
  { value: 'converted', label: 'Converted', color: 'bg-emerald-500' },
  { value: 'lost', label: 'Lost', color: 'bg-rose-500' },
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

  const inputClasses = "block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 sm:text-sm hover:border-slate-300"
  const labelClasses = "block text-sm font-semibold text-slate-700 mb-1.5"

  const [statusFormValue, setStatusFormValue] = useState<LeadStatus>(
    initialData?.status ?? 'new'
  )
  const statusOptions = STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 animate-fade-in">
          <div className="flex gap-3">
            <svg className="h-5 w-5 text-rose-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-rose-800">{state.error}</p>
          </div>
        </div>
      )}

      {/* Info Group */}
      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Lead Information</h3>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Name */}
          <div className="md:col-span-1">
            <label htmlFor="name" className={labelClasses}>
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={initialData?.name || ''}
                className={inputClasses}
                placeholder="John Doe"
              />
            </div>
          </div>

          {/* Company Name */}
          <div className="md:col-span-1">
            <label htmlFor="company_name" className={labelClasses}>
              Company
            </label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              defaultValue={initialData?.company_name || ''}
              className={inputClasses}
              placeholder="Company Inc."
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Phone */}
          <div>
            <label htmlFor="phone" className={labelClasses}>
              Phone Number
            </label>
            <div className="relative">
              <input
                type="tel"
                id="phone"
                name="phone"
                defaultValue={initialData?.phone || ''}
                className={inputClasses}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          {/* Source */}
          <div>
            <label htmlFor="source" className={labelClasses}>
              Source
            </label>
            <input
              type="text"
              id="source"
              name="source"
              defaultValue={initialData?.source || ''}
              className={inputClasses}
              placeholder="e.g. Website, LinkedIn"
            />
          </div>
        </div>
      </div>

      {/* Status & Follow-up Group */}
      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Status & Strategy</h3>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Status */}
          <div>
            <label htmlFor="status" className={labelClasses}>
              Current Status <span className="text-rose-500">*</span>
            </label>
            <input type="hidden" name="status" value={statusFormValue} readOnly />
            <ListboxDropdown
              id="status"
              value={statusFormValue}
              options={statusOptions}
              onChange={(v) => setStatusFormValue(v as LeadStatus)}
              ariaLabel="Lead status"
              className="min-h-[2.75rem]"
            />
          </div>

          {/* Next Follow-up Date */}
          {mode === 'create' ? (
            <div>
              <label htmlFor="follow_up_date" className={labelClasses}>
                Next Follow-up
              </label>
              <input
                type="date"
                id="follow_up_date"
                name="follow_up_date"
                defaultValue={
                  initialData?.follow_up_date
                    ? new Date(initialData.follow_up_date).toISOString().slice(0, 10)
                    : ''
                }
                className={inputClasses}
              />
            </div>
          ) : (
            <div className="flex items-center text-xs text-slate-500 italic pt-8">
              Follow-ups are managed via the Details page.
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className={labelClasses}>
          Internal Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initialData?.notes || ''}
          className={`${inputClasses} resize-none`}
          placeholder="Add any specific details or context here..."
        />
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          className="btn-gradient-smooth w-full rounded-xl px-4 py-4 text-sm font-bold text-white shadow-xl shadow-[#06B6D4]/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/20"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
