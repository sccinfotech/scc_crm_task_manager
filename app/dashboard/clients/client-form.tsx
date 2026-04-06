'use client'

import { useActionState, useState } from 'react'
import { ClientFormData, ClientStatus } from '@/lib/clients/actions'
import {
  EMAIL_INPUT_PATTERN,
  EMAIL_VALIDATION_MESSAGE,
  isValidEmailFormat,
  normalizeOptionalEmail,
} from '@/lib/validation/email'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'

interface ClientFormProps {
  initialData?: Partial<ClientFormData>
  onSubmit: (formData: ClientFormData) => Promise<{ error: string | null }>
  onSuccess?: () => void
  submitLabel?: string
  mode?: 'create' | 'edit'
}

const STATUS_OPTIONS: { value: ClientStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-500' },
]

export function ClientForm({
  initialData,
  onSubmit,
  onSuccess,
  submitLabel = 'Save Client',
  mode = 'create',
}: ClientFormProps) {
  const [state, formAction] = useActionState(
    async (_prevState: { error: string | null } | null, formData: FormData) => {
      const email = normalizeOptionalEmail(formData.get('email') as string)
      if (email && !isValidEmailFormat(email)) {
        return { error: EMAIL_VALIDATION_MESSAGE }
      }

      const clientData: ClientFormData = {
        name: formData.get('name') as string,
        company_name: formData.get('company_name') as string,
        phone: formData.get('phone') as string,
        email: email || undefined,
        status: formData.get('status') as ClientStatus,
        remark: formData.get('remark') as string,
        lead_id: formData.get('lead_id') as string,
        gst_number: (formData.get('gst_number') as string) || undefined,
        billing_state_code: (formData.get('billing_state_code') as string) || undefined,
      }

      const result = await onSubmit(clientData)
      if (!result.error && onSuccess) {
        onSuccess()
      }
      return result
    },
    null
  )

  const inputClasses = "block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 sm:text-sm hover:border-slate-300"
  const labelClasses = "block text-sm font-semibold text-slate-700 mb-1.5"

  const [statusFormValue, setStatusFormValue] = useState<ClientStatus>(
    initialData?.status ?? 'active'
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

      {/* Hidden lead_id field for conversion */}
      {initialData?.lead_id && (
        <input type="hidden" name="lead_id" value={initialData.lead_id} />
      )}

      {/* Info Group */}
      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Client Information</h3>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Name */}
          <div className="md:col-span-1">
            <label htmlFor="name" className={labelClasses}>
              Client Name <span className="text-rose-500">*</span>
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
              Company Name
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
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                id="phone"
                name="phone"
                required
                defaultValue={initialData?.phone || ''}
                className={inputClasses}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className={labelClasses}>
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              pattern={EMAIL_INPUT_PATTERN}
              title={EMAIL_VALIDATION_MESSAGE}
              defaultValue={initialData?.email || ''}
              className={inputClasses}
              placeholder="john@example.com"
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Billing State */}
          <div>
            <label htmlFor="billing_state_code" className={labelClasses}>
              Billing State Code <span className="text-slate-400 font-normal">(e.g. GJ)</span>
            </label>
            <input
              type="text"
              id="billing_state_code"
              name="billing_state_code"
              defaultValue={(initialData as { billing_state_code?: string } | undefined)?.billing_state_code || ''}
              className={inputClasses}
              placeholder="GJ"
              maxLength={2}
            />
          </div>

          {/* GST Number */}
          <div>
            <label htmlFor="gst_number" className={labelClasses}>
              GST Number <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              id="gst_number"
              name="gst_number"
              defaultValue={(initialData as { gst_number?: string } | undefined)?.gst_number || ''}
              className={inputClasses}
              placeholder="22AAAAA0000A1Z5"
            />
          </div>
        </div>
      </div>

      {/* Status Group */}
      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Status</h3>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Status */}
          <div>
            <label htmlFor="status" className={labelClasses}>
              Status <span className="text-rose-500">*</span>
            </label>
            <input type="hidden" name="status" value={statusFormValue} readOnly />
            <ListboxDropdown
              id="status"
              value={statusFormValue}
              options={statusOptions}
              onChange={(v) => setStatusFormValue(v as ClientStatus)}
              ariaLabel="Client status"
              className="min-h-[2.75rem]"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="remark" className={labelClasses}>
          Remark
        </label>
        <textarea
          id="remark"
          name="remark"
          rows={3}
          defaultValue={initialData?.remark || ''}
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
