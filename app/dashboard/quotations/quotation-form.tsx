'use client'

import { useActionState, useState, useEffect, useMemo, useRef } from 'react'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import {
  getQuotationRequirementUploadSignature,
  type QuotationFormData,
  type QuotationRequirementFormData,
  type QuotationStatus,
  type QuotationSourceType,
} from '@/lib/quotations/actions'
import type { LeadSelectOption } from '@/lib/leads/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import {
  type TechnologyTool,
  createTechnologyTool,
} from '@/lib/settings/technology-tools-actions'
import {
  PROJECT_REQUIREMENT_ALLOWED_EXTENSIONS,
  PROJECT_REQUIREMENT_ALLOWED_MIME_TYPES,
  PROJECT_REQUIREMENT_MAX_ATTACHMENT_SIZE_BYTES,
  PROJECT_REQUIREMENT_VIDEO_MAX_ATTACHMENT_SIZE_BYTES,
  getProjectRequirementMaxAttachmentSizeBytes,
} from '@/lib/projects/requirements-constants'
import { useToast } from '@/app/components/ui/toast-context'
import {
  QuotationLeadClientCombobox,
  type LeadOrClientOption,
} from './quotation-lead-client-combobox'
import { MediaViewerModal } from '@/app/components/ui/media-viewer-modal'

const STATUS_OPTIONS: { value: QuotationStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'under_discussion', label: 'Under Discussion' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
]

type PricingType = 'hourly' | 'fixed' | 'milestone'

type RequirementMilestoneDraft = {
  id: string
  title: string
  description: string
  due_date: string
  amount: string
}

type RequirementDraft = {
  id: string
  pricing_type: PricingType
  title: string
  description: string
  attachment_url: string
  attachment_file: File | null
  estimated_hours: string
  hourly_rate: string
  amount: string
  milestones: RequirementMilestoneDraft[]
}

const PRICING_TYPE_OPTIONS: { value: PricingType; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'hourly', label: 'Hour-based' },
  { value: 'milestone', label: 'Milestone-based' },
]

function generateDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `draft-${Math.random().toString(36).slice(2, 10)}`
}

function createEmptyMilestone(): RequirementMilestoneDraft {
  return {
    id: generateDraftId(),
    title: '',
    description: '',
    due_date: '',
    amount: '',
  }
}

function createEmptyRequirement(): RequirementDraft {
  return {
    id: generateDraftId(),
    pricing_type: 'fixed',
    title: '',
    description: '',
    attachment_url: '',
    attachment_file: null,
    estimated_hours: '',
    hourly_rate: '',
    amount: '',
    milestones: [],
  }
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function hasMilestoneContent(milestone: RequirementMilestoneDraft): boolean {
  return Boolean(
    milestone.title.trim() ||
      milestone.description.trim() ||
      milestone.due_date.trim() ||
      milestone.amount.trim()
  )
}

function hasRequirementContent(req: RequirementDraft): boolean {
  return Boolean(
      req.title.trim() ||
      req.description.trim() ||
      req.attachment_url.trim() ||
      Boolean(req.attachment_file) ||
      req.estimated_hours.trim() ||
      req.hourly_rate.trim() ||
      req.amount.trim() ||
      req.milestones.some(hasMilestoneContent)
  )
}

function buildRequirementPayload(req: RequirementDraft, finalAttachmentUrl?: string | null): QuotationRequirementFormData | null {
  if (!hasRequirementContent(req)) return null

  const normalizedMilestones = req.milestones
    .map((milestone) => {
      const title = milestone.title.trim()
      const description = milestone.description.trim()
      const dueDate = milestone.due_date.trim()
      return {
        title,
        description: description || null,
        due_date: dueDate || null,
        amount: toNumberOrNull(milestone.amount),
        hasContent: Boolean(title || description || dueDate || milestone.amount.trim()),
      }
    })
    .filter((milestone) => milestone.hasContent)

  return {
    requirement_type: 'initial',
    pricing_type: req.pricing_type,
    title: req.title.trim() || null,
    description: req.description.trim() || null,
    attachment_url: finalAttachmentUrl !== undefined ? finalAttachmentUrl : req.attachment_url.trim() || null,
    estimated_hours: req.pricing_type === 'hourly' ? toNumberOrNull(req.estimated_hours) : null,
    hourly_rate: req.pricing_type === 'hourly' ? toNumberOrNull(req.hourly_rate) : null,
    amount: req.pricing_type === 'milestone' ? null : toNumberOrNull(req.amount),
    milestones:
      req.pricing_type === 'milestone'
        ? normalizedMilestones.map((milestone) => ({
            title: milestone.title,
            description: milestone.description,
            due_date: milestone.due_date,
            amount: milestone.amount,
          }))
        : undefined,
  }
}

function mapFormDataRequirementToDraft(requirement: QuotationRequirementFormData): RequirementDraft {
  return {
    id: generateDraftId(),
    pricing_type: (requirement.pricing_type as PricingType) ?? 'fixed',
    title: requirement.title ?? '',
    description: requirement.description ?? '',
    attachment_url: requirement.attachment_url ?? '',
    attachment_file: null,
    estimated_hours: requirement.estimated_hours != null ? String(requirement.estimated_hours) : '',
    hourly_rate: requirement.hourly_rate != null ? String(requirement.hourly_rate) : '',
    amount: requirement.amount != null ? String(requirement.amount) : '',
    milestones: (requirement.milestones ?? []).map((milestone) => ({
      id: generateDraftId(),
      title: milestone.title ?? '',
      description: milestone.description ?? '',
      due_date: milestone.due_date ?? '',
      amount: milestone.amount != null ? String(milestone.amount) : '',
    })),
  }
}

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
const maxAttachmentSizeMB = PROJECT_REQUIREMENT_MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)
const maxVideoAttachmentSizeMB = PROJECT_REQUIREMENT_VIDEO_MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)

function getFileExtension(name: string) {
  const parts = name.split('.')
  if (parts.length < 2) return ''
  return parts[parts.length - 1].toLowerCase()
}

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
  const requirementFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [draggingRequirementId, setDraggingRequirementId] = useState<string | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<{
    url: string
    name?: string
    mimeType?: string | null
  } | null>(null)
  const [requirements, setRequirements] = useState<RequirementDraft[]>(() => {
    if (Array.isArray(initialData?.requirements) && initialData.requirements.length > 0) {
      return initialData.requirements.map(mapFormDataRequirementToDraft)
    }
    return []
  })

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
      const requirementsPayload: QuotationRequirementFormData[] = []

      if (mode === 'create') {
        for (const requirement of requirements) {
          let finalAttachmentUrl: string | null = requirement.attachment_url.trim() || null

          if (requirement.attachment_file) {
            const signatureResult = await getQuotationRequirementUploadSignature()
            if (signatureResult.error || !signatureResult.data) {
              return { error: signatureResult.error || 'Failed to prepare file upload.' }
            }

            const signature = signatureResult.data
            try {
              const uploadFormData = new FormData()
              uploadFormData.append('file', requirement.attachment_file)
              uploadFormData.append('api_key', signature.apiKey)
              uploadFormData.append('timestamp', String(signature.timestamp))
              uploadFormData.append('signature', signature.signature)
              uploadFormData.append('folder', signature.folder)

              const uploadResponse = await fetch(
                `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`,
                { method: 'POST', body: uploadFormData }
              )
              if (!uploadResponse.ok) {
                throw new Error('Upload failed')
              }
              const uploadData = (await uploadResponse.json()) as { secure_url?: string }
              finalAttachmentUrl = uploadData.secure_url ?? null
            } catch (error) {
              console.error('Quotation requirement attachment upload failed:', error)
              return { error: 'Could not upload requirement attachment. Please try again.' }
            }
          }

          const payload = buildRequirementPayload(requirement, finalAttachmentUrl)
          if (payload) {
            requirementsPayload.push(payload)
          }
        }
      }

      const data: QuotationFormData = {
        source_type: formData.get('source_type') as QuotationSourceType,
        lead_id: (formData.get('lead_id') as string) || undefined,
        client_id: (formData.get('client_id') as string) || undefined,
        valid_till: (formData.get('valid_till') as string) || undefined,
        title: (formData.get('title') as string) || undefined,
        notes: (formData.get('notes') as string) || undefined,
        reference: (formData.get('reference') as string) || undefined,
        status: formData.get('status') as QuotationStatus,
        discount: Number.parseFloat((formData.get('discount') as string) || '0') || 0,
        technology_tool_ids: technology_tool_ids.length ? technology_tool_ids : undefined,
        requirements: requirementsPayload.length ? requirementsPayload : undefined,
      }
      return onSubmit(data)
    },
    null
  )

  const handleAddRequirement = () => {
    setRequirements((prev) => [...prev, createEmptyRequirement()])
  }

  const handleRemoveRequirement = (requirementId: string) => {
    setRequirements((prev) => prev.filter((req) => req.id !== requirementId))
  }

  const handleRequirementFieldChange = (
    requirementId: string,
    field: 'title' | 'description' | 'attachment_url' | 'estimated_hours' | 'hourly_rate' | 'amount',
    value: string
  ) => {
    setRequirements((prev) =>
      prev.map((req) => (req.id === requirementId ? { ...req, [field]: value } : req))
    )
  }

  const handlePricingTypeChange = (requirementId: string, value: PricingType) => {
    setRequirements((prev) =>
      prev.map((req) => {
        if (req.id !== requirementId) return req
        return {
          ...req,
          pricing_type: value,
          milestones: value === 'milestone' ? req.milestones : [],
        }
      })
    )
  }

  const handleAddMilestone = (requirementId: string) => {
    setRequirements((prev) =>
      prev.map((req) =>
        req.id === requirementId ? { ...req, milestones: [...req.milestones, createEmptyMilestone()] } : req
      )
    )
  }

  const handleRemoveMilestone = (requirementId: string, milestoneId: string) => {
    setRequirements((prev) =>
      prev.map((req) =>
        req.id === requirementId
          ? { ...req, milestones: req.milestones.filter((milestone) => milestone.id !== milestoneId) }
          : req
      )
    )
  }

  const handleMilestoneFieldChange = (
    requirementId: string,
    milestoneId: string,
    field: 'title' | 'description' | 'due_date' | 'amount',
    value: string
  ) => {
    setRequirements((prev) =>
      prev.map((req) =>
        req.id === requirementId
          ? {
              ...req,
              milestones: req.milestones.map((milestone) =>
                milestone.id === milestoneId ? { ...milestone, [field]: value } : milestone
              ),
            }
          : req
      )
    )
  }

  const validateRequirementFile = (file: File): boolean => {
    const extension = getFileExtension(file.name)
    const isAllowedExtension = PROJECT_REQUIREMENT_ALLOWED_EXTENSIONS.includes(
      extension as (typeof PROJECT_REQUIREMENT_ALLOWED_EXTENSIONS)[number]
    )
    const isAllowedMime = PROJECT_REQUIREMENT_ALLOWED_MIME_TYPES.includes(
      file.type as (typeof PROJECT_REQUIREMENT_ALLOWED_MIME_TYPES)[number]
    )

    if (!isAllowedExtension && !isAllowedMime) {
      showToastError(
        'Unsupported File',
        'Allowed types: PDF, DOC/DOCX, XLS/XLSX, PNG/JPG, TXT, RTF, ZIP, MOV.'
      )
      return false
    }

    const maxBytes = getProjectRequirementMaxAttachmentSizeBytes(file.type, extension)
    if (file.size > maxBytes) {
      const mb = maxBytes / (1024 * 1024)
      showToastError('File Too Large', `Max size is ${mb} MB for this file type.`)
      return false
    }

    return true
  }

  const handleRequirementFileChange = (
    requirementId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!validateRequirementFile(file)) {
      event.target.value = ''
      return
    }
    setRequirements((prev) =>
      prev.map((req) =>
        req.id === requirementId
          ? {
              ...req,
              attachment_file: file,
            }
          : req
      )
    )
    event.target.value = ''
  }

  const handleRemoveAttachment = (requirementId: string) => {
    setRequirements((prev) =>
      prev.map((req) =>
        req.id === requirementId
          ? {
              ...req,
              attachment_file: null,
              attachment_url: '',
            }
          : req
      )
    )
  }

  const handleDropAttachment = (requirementId: string, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDraggingRequirementId(null)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    if (!validateRequirementFile(file)) return
    setRequirements((prev) =>
      prev.map((req) =>
        req.id === requirementId
          ? {
              ...req,
              attachment_file: file,
            }
          : req
      )
    )
  }

  const handleDragOverAttachment = (requirementId: string, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (draggingRequirementId !== requirementId) {
      setDraggingRequirementId(requirementId)
    }
  }

  const handleDragLeaveAttachment = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDraggingRequirementId(null)
  }

  return (
    <form action={formAction} className="space-y-4">
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

      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Basic Information</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="title" className={labelClasses}>
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              defaultValue={initialData?.title ?? ''}
              className={inputClasses}
              placeholder="Enter quotation title"
            />
          </div>
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
          <div className="md:col-span-2">
            <label htmlFor="notes" className={labelClasses}>
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={initialData?.notes ?? ''}
              rows={3}
              className={inputClasses}
              placeholder="Internal notes about this quotation"
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

      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Technology & Tools</h3>
        {technologyToolsError && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-sm text-amber-800">{technologyToolsError}</p>
          </div>
        )}
        <div className="space-y-3">
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

      {mode === 'create' && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Requirements</h3>
            <button
              type="button"
              onClick={handleAddRequirement}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Requirement
            </button>
          </div>

          {requirements.length === 0 ? (
            <p className="text-sm text-slate-500">
              Add quotation requirements here. These will be saved when the quotation is created.
            </p>
          ) : (
            <div className="space-y-3">
              {requirements.map((requirement, index) => (
                <div key={requirement.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">Requirement #{index + 1}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveRequirement(requirement.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClasses}>Requirement Type</label>
                      <div className="flex min-h-[2.75rem] items-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                        Initial Requirement
                      </div>
                    </div>
                    <div>
                      <label className={labelClasses}>Pricing Type</label>
                      <ListboxDropdown
                        value={requirement.pricing_type}
                        options={PRICING_TYPE_OPTIONS}
                        onChange={(value) => handlePricingTypeChange(requirement.id, value)}
                        ariaLabel={`Pricing type ${index + 1}`}
                        className="min-h-[2.75rem]"
                      />
                    </div>
                  </div>

                  <div className="max-w-xl">
                    <div>
                      <label className={labelClasses}>Title</label>
                      <input
                        type="text"
                        value={requirement.title}
                        onChange={(e) => handleRequirementFieldChange(requirement.id, 'title', e.target.value)}
                        className={inputClasses}
                        placeholder="Requirement title"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClasses}>Description</label>
                    <textarea
                      value={requirement.description}
                      onChange={(e) => handleRequirementFieldChange(requirement.id, 'description', e.target.value)}
                      rows={3}
                      className={inputClasses}
                      placeholder="Requirement details"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Attachment</p>
                        <p className="text-xs text-slate-500">Upload supporting files for this requirement.</p>
                      </div>
                      {(requirement.attachment_url || requirement.attachment_file) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(requirement.id)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="mt-3">
                      {requirement.attachment_url && !requirement.attachment_file && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewAttachment({
                              url: requirement.attachment_url!,
                              name:
                                requirement.attachment_file?.name?.trim() || 'Requirement attachment',
                              mimeType: requirement.attachment_file?.type || null,
                            })
                          }
                          className="text-sm font-semibold text-cyan-700 hover:underline"
                        >
                          View current attachment
                        </button>
                      )}
                      {requirement.attachment_file && (
                        <p className="text-sm font-semibold text-slate-700">{requirement.attachment_file.name}</p>
                      )}
                      <div
                        className={`mt-3 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-4 text-center transition-colors ${
                          draggingRequirementId === requirement.id ? 'border-cyan-500 bg-cyan-50/60' : 'border-slate-200 bg-white'
                        }`}
                        onDragOver={(event) => handleDragOverAttachment(requirement.id, event)}
                        onDragLeave={handleDragLeaveAttachment}
                        onDrop={(event) => handleDropAttachment(requirement.id, event)}
                      >
                        <input
                          ref={(node) => {
                            requirementFileInputRefs.current[requirement.id] = node
                          }}
                          type="file"
                          accept={PROJECT_REQUIREMENT_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
                          onChange={(event) => handleRequirementFileChange(requirement.id, event)}
                          className="hidden"
                        />
                        <p className="text-sm text-slate-700">
                          <button
                            type="button"
                            className="font-semibold text-cyan-700 hover:text-cyan-800"
                            onClick={() => requirementFileInputRefs.current[requirement.id]?.click()}
                          >
                            Click to upload
                          </button>{' '}
                          or drag and drop a file here.
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Supported: PDF, DOC/DOCX, XLS/XLSX, PNG/JPG, TXT, RTF, ZIP, MOV • Max{' '}
                          {maxAttachmentSizeMB} MB ({maxVideoAttachmentSizeMB} MB for MOV)
                        </p>
                      </div>
                    </div>
                  </div>

                  {requirement.pricing_type === 'hourly' && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className={labelClasses}>Estimated Hours</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={requirement.estimated_hours}
                          onChange={(e) => handleRequirementFieldChange(requirement.id, 'estimated_hours', e.target.value)}
                          className={inputClasses}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className={labelClasses}>Hourly Rate</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={requirement.hourly_rate}
                          onChange={(e) => handleRequirementFieldChange(requirement.id, 'hourly_rate', e.target.value)}
                          className={inputClasses}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className={labelClasses}>Amount (optional override)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={requirement.amount}
                          onChange={(e) => handleRequirementFieldChange(requirement.id, 'amount', e.target.value)}
                          className={inputClasses}
                          placeholder="Auto-calculated if empty"
                        />
                      </div>
                    </div>
                  )}

                  {requirement.pricing_type === 'fixed' && (
                    <div className="max-w-sm">
                      <label className={labelClasses}>Amount</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={requirement.amount}
                        onChange={(e) => handleRequirementFieldChange(requirement.id, 'amount', e.target.value)}
                        className={inputClasses}
                        placeholder="0.00"
                      />
                    </div>
                  )}

                  {requirement.pricing_type === 'milestone' && (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-700">Milestones</p>
                        <button
                          type="button"
                          onClick={() => handleAddMilestone(requirement.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Add Milestone
                        </button>
                      </div>

                      {requirement.milestones.length === 0 ? (
                        <p className="text-xs text-slate-500">Add at least one milestone for milestone-based pricing.</p>
                      ) : (
                        <div className="space-y-3">
                          {requirement.milestones.map((milestone, milestoneIndex) => (
                            <div key={milestone.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                  Milestone {milestoneIndex + 1}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMilestone(requirement.id, milestone.id)}
                                  className="rounded-lg p-1 text-rose-500 hover:bg-rose-50"
                                  aria-label={`Remove milestone ${milestoneIndex + 1}`}
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <label className={labelClasses}>Title</label>
                                  <input
                                    type="text"
                                    value={milestone.title}
                                    onChange={(e) =>
                                      handleMilestoneFieldChange(requirement.id, milestone.id, 'title', e.target.value)
                                    }
                                    className={inputClasses}
                                    placeholder="Milestone title"
                                  />
                                </div>
                                <div>
                                  <label className={labelClasses}>Amount</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={milestone.amount}
                                    onChange={(e) =>
                                      handleMilestoneFieldChange(requirement.id, milestone.id, 'amount', e.target.value)
                                    }
                                    className={inputClasses}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>

                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <label className={labelClasses}>Due Date</label>
                                  <input
                                    type="date"
                                    value={milestone.due_date}
                                    onChange={(e) =>
                                      handleMilestoneFieldChange(requirement.id, milestone.id, 'due_date', e.target.value)
                                    }
                                    className={inputClasses}
                                  />
                                </div>
                                <div>
                                  <label className={labelClasses}>Description</label>
                                  <input
                                    type="text"
                                    value={milestone.description}
                                    onChange={(e) =>
                                      handleMilestoneFieldChange(requirement.id, milestone.id, 'description', e.target.value)
                                    }
                                    className={inputClasses}
                                    placeholder="Optional details"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          className="w-full rounded-xl bg-[#06B6D4] px-4 py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#0891b2] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/20"
        >
          {submitLabel}
        </button>
      </div>

      <MediaViewerModal
        isOpen={Boolean(previewAttachment)}
        mediaUrl={previewAttachment?.url ?? null}
        fileName={previewAttachment?.name ?? null}
        mimeType={previewAttachment?.mimeType ?? null}
        onClose={() => setPreviewAttachment(null)}
      />
    </form>
  )
}
