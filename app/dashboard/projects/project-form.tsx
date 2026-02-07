'use client'

import { useActionState, useRef, useState } from 'react'
import {
  ProjectFormData,
  ProjectPriority,
  getProjectLogoUploadSignature,
} from '@/lib/projects/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'
import type { StaffSelectOption } from '@/lib/users/actions'

interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>
  onSubmit: (formData: ProjectFormData) => Promise<{ error: string | null }>
  onSuccess?: () => void
  submitLabel?: string
  mode?: 'create' | 'edit'
  clients: ClientSelectOption[]
  clientsError: string | null
  canViewAmount: boolean
  technologyTools: TechnologyTool[]
  technologyToolsError: string | null
  teamMembers: StaffSelectOption[]
  teamMembersError: string | null
}

const PRIORITY_OPTIONS: { value: ProjectPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024

function formatDateValue(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : ''
}

export function ProjectForm({
  initialData,
  onSubmit,
  onSuccess,
  submitLabel = 'Save Project',
  mode = 'create',
  clients,
  clientsError,
  canViewAmount,
  technologyTools,
  technologyToolsError,
  teamMembers,
  teamMembersError,
}: ProjectFormProps) {
  const [logoUrl, setLogoUrl] = useState(initialData?.logo_url || '')
  const [logoError, setLogoError] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(
    initialData?.technology_tool_ids ?? []
  )
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    initialData?.team_member_ids ?? []
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [state, formAction, isPending] = useActionState(
    async (_prevState: { error: string | null } | null, formData: FormData) => {
      const amountValue = canViewAmount ? Number.parseFloat(formData.get('project_amount') as string) : undefined
      const projectData: ProjectFormData = {
        name: (formData.get('name') as string) || '',
        logo_url: logoUrl || undefined,
        client_id: (formData.get('client_id') as string) || '',
        project_amount: Number.isFinite(amountValue) ? amountValue : undefined,
        priority: (formData.get('priority') as ProjectPriority) || 'medium',
        start_date: (formData.get('start_date') as string) || '',
        developer_deadline_date: (formData.get('developer_deadline_date') as string) || '',
        client_deadline_date: (formData.get('client_deadline_date') as string) || '',
        website_links: (formData.get('website_links') as string) || undefined,
        reference_links: (formData.get('reference_links') as string) || undefined,
        technology_tool_ids: selectedToolIds,
        team_member_ids: selectedMemberIds,
      }

      const result = await onSubmit(projectData)
      if (!result.error && onSuccess) {
        onSuccess()
      }
      return result
    },
    null
  )

  const inputClasses =
    'block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 sm:text-sm hover:border-slate-300'
  const labelClasses = 'block text-sm font-semibold text-slate-700 mb-1.5'

  const startDateValue = formatDateValue(initialData?.start_date)
  const developerDeadlineValue = formatDateValue(initialData?.developer_deadline_date)
  const clientDeadlineValue = formatDateValue(initialData?.client_deadline_date)

  const handleLogoClick = () => {
    fileInputRef.current?.click()
  }

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setLogoError('Logo must be 2 MB or less.')
      event.target.value = ''
      return
    }

    if (!file.type.startsWith('image/')) {
      setLogoError('Logo must be an image file.')
      event.target.value = ''
      return
    }

    setLogoError(null)
    setIsUploadingLogo(true)

    const signatureResult = await getProjectLogoUploadSignature()
    if (signatureResult.error || !signatureResult.data) {
      setIsUploadingLogo(false)
      setLogoError(signatureResult.error || 'Failed to prepare logo upload.')
      return
    }

    try {
      const signature = signatureResult.data
      const uploadForm = new FormData()
      uploadForm.append('file', file)
      uploadForm.append('api_key', signature.apiKey)
      uploadForm.append('timestamp', String(signature.timestamp))
      uploadForm.append('signature', signature.signature)
      uploadForm.append('folder', signature.folder)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
        {
          method: 'POST',
          body: uploadForm,
        }
      )

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      setLogoUrl(data.secure_url)
    } catch (uploadError) {
      console.error('Project logo upload failed:', uploadError)
      setLogoError('Could not upload logo. Please try again.')
    } finally {
      setIsUploadingLogo(false)
    }
  }

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

      {/* Project Info */}
      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Project Information</h3>

        <div className="grid gap-5 md:grid-cols-2 md:grid-rows-2 md:items-stretch">
          <div>
            <label htmlFor="name" className={labelClasses}>
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              defaultValue={initialData?.name || ''}
              className={inputClasses}
              placeholder="Website Redesign"
            />
          </div>

          <div className="md:row-span-2 min-h-0 flex flex-col">
            <label className={labelClasses}>Project logo</label>
            <p className="text-xs text-slate-500 mb-3">Optional · PNG, JPG or GIF · Max 2 MB</p>
            <div
              role="button"
              tabIndex={0}
              onClick={handleLogoClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleLogoClick()
                }
              }}
              className={`
                group relative flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
                min-h-[120px] w-full overflow-hidden
                ${logoUrl
                  ? 'border-slate-200 bg-slate-50/50 hover:border-cyan-300 hover:bg-cyan-50/30'
                  : 'border-slate-200 bg-white hover:border-[#06B6D4] hover:bg-[#06B6D4]/5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2'
                }
                ${isUploadingLogo ? 'pointer-events-none opacity-70' : ''}
              `}
            >
              {logoUrl ? (
                <>
                  <img
                    src={logoUrl}
                    alt="Project logo"
                    className="h-20 w-20 rounded-xl object-cover shadow-sm border border-slate-100"
                  />
                  {!isUploadingLogo && (
                    <p className="mt-3 text-sm font-medium text-slate-600">Click to change</p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition-colors duration-200 group-hover:bg-[#06B6D4]/10 group-hover:text-[#06B6D4]">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  {!isUploadingLogo && (
                    <p className="mt-3 text-sm font-medium text-slate-600">
                      Click to upload or drag and drop
                    </p>
                  )}
                </>
              )}
              {isUploadingLogo && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="h-8 w-8 animate-spin text-[#06B6D4]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm font-medium text-slate-600">Uploading...</span>
                  </div>
                </div>
              )}
            </div>
            {logoUrl && !isUploadingLogo && (
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleLogoClick() }}
                  className="text-sm font-medium text-[#06B6D4] transition-colors duration-200 hover:text-[#0891b2] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-1 rounded-lg px-2 py-1"
                >
                  Change logo
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLogoUrl('') }}
                  className="text-sm font-medium text-rose-600 transition-colors duration-200 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 rounded-lg px-2 py-1"
                >
                  Remove logo
                </button>
              </div>
            )}
            {logoError && (
              <p className="mt-2 text-sm text-rose-600 flex items-center gap-1.5" role="alert">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {logoError}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>

          <div>
            <label htmlFor="priority" className={labelClasses}>
              Priority
            </label>
            <div className="relative">
              <select
                id="priority"
                name="priority"
                defaultValue={initialData?.priority || 'medium'}
                className={`${inputClasses} appearance-none cursor-pointer`}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client & Financial */}
      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Client & Financials</h3>

        {clientsError && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-sm text-amber-800">{clientsError}</p>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="client_id" className={labelClasses}>
              Client <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                id="client_id"
                name="client_id"
                required
                defaultValue={initialData?.client_id || ''}
                className={`${inputClasses} appearance-none cursor-pointer`}
              >
                <option value="" disabled>
                  Select a client
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}{client.company_name ? ` (${client.company_name})` : ''}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {clients.length === 0 && !clientsError && (
              <p className="mt-2 text-xs text-slate-500">No clients found. Add a client first.</p>
            )}
          </div>

          <div>
            {canViewAmount ? (
              <>
                <label htmlFor="project_amount" className={labelClasses}>
                  Project Amount
                </label>
                <input
                  type="number"
                  id="project_amount"
                  name="project_amount"
                  min="0"
                  step="0.01"
                  defaultValue={
                    initialData?.project_amount !== undefined && initialData?.project_amount !== null
                      ? String(initialData.project_amount)
                      : ''
                  }
                  className={inputClasses}
                  placeholder="0.00"
                />
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                Project amount is visible only to admins and managers.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status & Schedule */}
      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Status & Schedule</h3>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="start_date" className={labelClasses}>
              Start Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              id="start_date"
              name="start_date"
              required
              defaultValue={startDateValue}
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="developer_deadline_date" className={labelClasses}>
              Developer Deadline <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              id="developer_deadline_date"
              name="developer_deadline_date"
              required
              defaultValue={developerDeadlineValue}
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="client_deadline_date" className={labelClasses}>
              Client Deadline <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              id="client_deadline_date"
              name="client_deadline_date"
              required
              defaultValue={clientDeadlineValue}
              className={inputClasses}
            />
          </div>
        </div>

        {mode === 'edit' && (
          <div className="flex items-center text-xs text-slate-500 italic">
            Follow-ups are managed via the Details page.
          </div>
        )}
      </div>

      {/* Technology & Tools */}
      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Technology & Tools</h3>

        {technologyToolsError && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-sm text-amber-800">{technologyToolsError}</p>
          </div>
        )}

        {technologyTools.length === 0 ? (
          <p className="text-sm text-slate-500">
            No tools found. Add items in Settings to populate this list.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="technology_tool_select" className={labelClasses}>
                Add technology or tool
              </label>
              <div className="relative">
                <select
                  id="technology_tool_select"
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    if (id) {
                      setSelectedToolIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                      e.target.value = ''
                    }
                  }}
                  className={`${inputClasses} appearance-none cursor-pointer`}
                >
                  <option value="">Select a technology or tool</option>
                  {technologyTools
                    .filter((t) => !selectedToolIds.includes(t.id))
                    .map((tool) => (
                      <option key={tool.id} value={tool.id}>
                        {tool.name}
                      </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            {selectedToolIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedToolIds.map((id) => {
                  const tool = technologyTools.find((t) => t.id === id)
                  const label = tool ? tool.name : id
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-medium text-cyan-800"
                    >
                      <span className="truncate max-w-[160px]">{label}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedToolIds((prev) => prev.filter((tid) => tid !== id))}
                        className="rounded p-0.5 text-cyan-600 transition-colors hover:bg-cyan-200/80 hover:text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label={`Remove ${label}`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Team Members</h3>

        {teamMembersError && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-sm text-amber-800">{teamMembersError}</p>
          </div>
        )}

        {teamMembers.length === 0 ? (
          <p className="text-sm text-slate-500">
            No staff members found. Add staff users to assign them to projects.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="staff_member_select" className={labelClasses}>
                Add staff member
              </label>
              <div className="relative">
                <select
                  id="staff_member_select"
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    if (id) {
                      setSelectedMemberIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                      e.target.value = ''
                    }
                  }}
                  className={`${inputClasses} appearance-none cursor-pointer`}
                >
                  <option value="">Select a staff member</option>
                  {teamMembers
                    .filter((m) => !selectedMemberIds.includes(m.id))
                    .map((member) => {
                      const label = member.full_name || member.email || 'Unnamed Staff'
                      return (
                        <option key={member.id} value={member.id}>
                          {label}
                        </option>
                      )
                    })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            {selectedMemberIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedMemberIds.map((id) => {
                  const member = teamMembers.find((m) => m.id === id)
                  const label = member ? member.full_name || member.email || 'Unnamed Staff' : id
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-medium text-cyan-800"
                    >
                      <span className="truncate max-w-[160px]">{label}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMemberIds((prev) => prev.filter((mid) => mid !== id))}
                        className="rounded p-0.5 text-cyan-600 transition-colors hover:bg-cyan-200/80 hover:text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label={`Remove ${label}`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Website & Reference Links */}
      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Links</h3>
        <p className="text-xs text-slate-500">Enter multiple links separated by commas.</p>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="website_links" className={labelClasses}>
              Website Links
            </label>
            <input
              type="text"
              id="website_links"
              name="website_links"
              defaultValue={initialData?.website_links || ''}
              className={inputClasses}
              placeholder="https://example.com, https://app.example.com"
            />
          </div>
          <div>
            <label htmlFor="reference_links" className={labelClasses}>
              Reference Site Links
            </label>
            <input
              type="text"
              id="reference_links"
              name="reference_links"
              defaultValue={initialData?.reference_links || ''}
              className={inputClasses}
              placeholder="https://reference1.com, https://reference2.com"
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="submit"
          disabled={isPending || isUploadingLogo}
          className="btn-gradient-smooth rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending || isUploadingLogo ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
