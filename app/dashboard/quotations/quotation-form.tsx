'use client'

import { useActionState, useState, useEffect, useMemo, useRef } from 'react'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import {
  type QuotationFormData,
  type QuotationStatus,
  type QuotationSourceType,
} from '@/lib/quotations/actions'
import type { LeadSelectOption } from '@/lib/leads/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import {
  type TechnologyTool,
  createTechnologyTool,
} from '@/lib/settings/technology-tools-actions'
import { useToast } from '@/app/components/ui/toast-context'
import {
  QuotationLeadClientCombobox,
  type LeadOrClientOption,
} from './quotation-lead-client-combobox'

const STATUS_OPTIONS: { value: QuotationStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'under_discussion', label: 'Under Discussion' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
]

function buildLeadOrClientValue(type: 'lead' | 'client', id: string): string {
  return `${type}:${id}`
}

function parseLeadOrClientValue(value: string): { type: QuotationSourceType; id: string } | null {
  if (!value) return null
  if (value.startsWith('lead:')) return { type: 'lead', id: value.slice(5) }
  if (value.startsWith('client:')) return { type: 'client', id: value.slice(7) }
  return null
}

interface QuotationFormProps {
  initialData?: Partial<QuotationFormData>
  onSubmit: (formData: QuotationFormData) => Promise<{ error: string | null }>
  submitLabel?: string
  mode?: 'create' | 'edit'
  leads: LeadSelectOption[]
  clients: ClientSelectOption[]
  technologyTools: TechnologyTool[]
  technologyToolsError?: string | null
  canCreateLead?: boolean
  onCreateLeadClick?: () => void
  preselectedLeadOrClient?: string | null
  onPreselectedApplied?: () => void
}

const inputClasses =
  'block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 sm:text-sm'
const labelClasses = 'block text-sm font-semibold text-slate-700 mb-1.5'

export function QuotationForm({
  initialData,
  onSubmit,
  submitLabel = 'Save Quotation',
  mode = 'create',
  leads,
  clients,
  technologyTools,
  technologyToolsError = null,
  canCreateLead = false,
  onCreateLeadClick,
  preselectedLeadOrClient,
  onPreselectedApplied,
}: QuotationFormProps) {
  const { success: showToastSuccess, error: showToastError } = useToast()
  const getInitialSelectedValue = () => {
    if (initialData?.lead_id) return buildLeadOrClientValue('lead', initialData.lead_id)
    if (initialData?.client_id) return buildLeadOrClientValue('client', initialData.client_id)
    return ''
  }
  const [selectedLeadOrClientValue, setSelectedLeadOrClientValue] = useState(getInitialSelectedValue)

  const parsed = useMemo(() => parseLeadOrClientValue(selectedLeadOrClientValue), [selectedLeadOrClientValue])
  const sourceType: QuotationSourceType = parsed?.type ?? 'lead'
  const leadId = sourceType === 'lead' && parsed ? parsed.id : ''
  const clientId = sourceType === 'client' && parsed ? parsed.id : ''

  const [statusValue, setStatusValue] = useState<QuotationStatus>(
    (initialData?.status as QuotationStatus) ?? 'draft'
  )
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(
    initialData?.technology_tool_ids ?? []
  )
  const [toolsList, setToolsList] = useState<TechnologyTool[]>(technologyTools)
  const [toolSearchQuery, setToolSearchQuery] = useState('')
  const [toolDropdownOpen, setToolDropdownOpen] = useState(false)
  const toolComboRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setToolsList(technologyTools)
  }, [technologyTools])

  useEffect(() => {
    if (!toolDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (toolComboRef.current && !toolComboRef.current.contains(e.target as Node)) {
        setToolDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [toolDropdownOpen])

  useEffect(() => {
    if (preselectedLeadOrClient && preselectedLeadOrClient !== selectedLeadOrClientValue) {
      setSelectedLeadOrClientValue(preselectedLeadOrClient)
      onPreselectedApplied?.()
    }
  }, [preselectedLeadOrClient, selectedLeadOrClientValue, onPreselectedApplied])

  const leadOrClientOptions = useMemo<LeadOrClientOption[]>(() => {
    const leadList = leads ?? []
    const clientList = clients ?? []
    const leadOpts: LeadOrClientOption[] = leadList.map((l) => ({
      value: buildLeadOrClientValue('lead', l.id),
      label: l.company_name ? `${l.name} (${l.company_name})` : l.name,
      type: 'lead',
    }))
    const clientOpts: LeadOrClientOption[] = clientList.map((c) => ({
      value: buildLeadOrClientValue('client', c.id),
      label: c.company_name ? `${c.name} (${c.company_name})` : c.name,
      type: 'client',
    }))
    return [...leadOpts, ...clientOpts].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  }, [leads, clients])

  const [state, formAction] = useActionState(
    async (_prev: { error: string | null } | null, formData: FormData) => {
      const technology_tool_ids = selectedToolIds
      const data: QuotationFormData = {
        source_type: formData.get('source_type') as QuotationSourceType,
        lead_id: (formData.get('lead_id') as string) || undefined,
        client_id: (formData.get('client_id') as string) || undefined,
        valid_till: (formData.get('valid_till') as string) || undefined,
        reference: (formData.get('reference') as string) || undefined,
        status: formData.get('status') as QuotationStatus,
        discount: Number.parseFloat((formData.get('discount') as string) || '0') || 0,
        technology_tool_ids: technology_tool_ids.length ? technology_tool_ids : undefined,
      }
      return onSubmit(data)
    },
    null
  )

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
          <p className="text-sm font-medium text-rose-800">{state.error}</p>
        </div>
      )}

      <input type="hidden" name="source_type" value={sourceType} />
      <input type="hidden" name="status" value={statusValue} />
      <input type="hidden" name="discount" value={initialData?.discount ?? 0} />
      {sourceType === 'lead' && <input type="hidden" name="lead_id" value={leadId} />}
      {sourceType === 'client' && <input type="hidden" name="client_id" value={clientId} />}

      <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Basic Information</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor="lead-or-client" className={labelClasses}>
                Lead or Client <span className="text-rose-500">*</span>
              </label>
              {canCreateLead && onCreateLeadClick && (
                <button
                  type="button"
                  onClick={onCreateLeadClick}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-cyan-600 bg-cyan-50 border border-cyan-200 transition-colors duration-200 hover:bg-cyan-100 hover:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create Lead
                </button>
              )}
            </div>
            <QuotationLeadClientCombobox
              id="lead-or-client"
              value={selectedLeadOrClientValue}
              options={leadOrClientOptions}
              onChange={setSelectedLeadOrClientValue}
              placeholder="Search and select lead or client…"
              ariaLabel="Lead or client"
              className="min-h-[2.75rem]"
            />
            {leadOrClientOptions.length === 0 && (
              <p className="mt-2 text-xs text-slate-500">
                No leads or clients found. Add a lead or use an existing client.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="valid_till" className={labelClasses}>
              Valid Till
            </label>
            <input
              type="date"
              id="valid_till"
              name="valid_till"
              defaultValue={initialData?.valid_till ?? ''}
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="reference" className={labelClasses}>
              Reference
            </label>
            <input
              type="text"
              id="reference"
              name="reference"
              defaultValue={initialData?.reference ?? ''}
              className={inputClasses}
              placeholder="Optional reference"
            />
          </div>
          <div>
            <label className={labelClasses}>Status</label>
            <ListboxDropdown
              value={statusValue}
              options={STATUS_OPTIONS}
              onChange={setStatusValue}
              ariaLabel="Status"
              className="min-h-[2.75rem]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Technology & Tools</h3>
        {technologyToolsError && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-sm text-amber-800">{technologyToolsError}</p>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label htmlFor="technology_tool_search" className={labelClasses}>
              Add technology or tool
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Search and select, or type a new name to create it
            </p>
            <div className="relative" ref={toolComboRef}>
              <div className="relative">
                <input
                  id="technology_tool_search"
                  type="text"
                  value={toolSearchQuery}
                  onChange={(e) => {
                    setToolSearchQuery(e.target.value)
                    setToolDropdownOpen(true)
                  }}
                  onFocus={() => setToolDropdownOpen(true)}
                  placeholder="Search or type new..."
                  className={`${inputClasses} pr-10`}
                  autoComplete="off"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              {toolDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5">
                  {(() => {
                    const q = toolSearchQuery.trim().toLowerCase()
                    const available = toolsList.filter(
                      (t) => !selectedToolIds.includes(t.id) && (!q || t.name.toLowerCase().includes(q))
                    )
                    const exactMatch = q && toolsList.some((t) => t.name.toLowerCase() === q)
                    const showCreate = q && !exactMatch
                    if (available.length === 0 && !showCreate) {
                      return (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          {q ? (showCreate ? '' : 'No matches') : 'Type to search or add new'}
                        </div>
                      )
                    }
                    return (
                      <>
                        {available.map((tool) => (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => {
                              setSelectedToolIds((prev) => (prev.includes(tool.id) ? prev : [...prev, tool.id]))
                              setToolSearchQuery('')
                              setToolDropdownOpen(false)
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
                          >
                            {tool.name}
                          </button>
                        ))}
                        {showCreate && (
                          <button
                            type="button"
                            onClick={async () => {
                              const name = toolSearchQuery.trim()
                              if (!name) return
                              setToolDropdownOpen(false)
                              const result = await createTechnologyTool({ name })
                              if (!result.error && result.data) {
                                setToolsList((prev) => [...prev, result.data!])
                                setSelectedToolIds((prev) => [...prev, result.data!.id])
                                setToolSearchQuery('')
                                showToastSuccess('Added', `"${name}" added as a new technology/tool.`)
                              } else {
                                showToastError('Could not add', result.error ?? 'You may not have permission to add tools.')
                              }
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-cyan-600 font-medium hover:bg-cyan-50 transition-colors duration-200 cursor-pointer flex items-center gap-2 border-t border-slate-100 mt-1 pt-2"
                          >
                            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Create &quot;{toolSearchQuery.trim()}&quot;
                          </button>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
          {selectedToolIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedToolIds.map((id) => {
                const tool = toolsList.find((t) => t.id === id)
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
                      className="rounded p-0.5 text-cyan-600 transition-colors duration-200 hover:bg-cyan-200/80 hover:text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                      aria-label={`Remove ${label}`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          className="w-full rounded-xl bg-[#06B6D4] px-4 py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#0891b2] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/20"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
