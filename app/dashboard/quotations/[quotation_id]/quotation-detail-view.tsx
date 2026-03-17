'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import type { Quotation, QuotationRequirement, QuotationStatus } from '@/lib/quotations/actions'
import {
  updateQuotation,
  changeQuotationStatus,
  updateQuotationTermsSupport,
  deleteQuotation,
  startQuotationConversion,
  completeQuotationConversion,
  type QuotationFormData,
} from '@/lib/quotations/actions'
import { createProject, type ProjectFormData } from '@/lib/projects/actions'
import { getClientsForSelect } from '@/lib/clients/actions'
import type { LeadSelectOption } from '@/lib/leads/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'
import type { StaffSelectOption } from '@/lib/users/actions'
import { downloadQuotationPdf } from '@/lib/quotations/pdf-download'
import { QuotationModal } from '../quotation-modal'
import { QuotationRequirements } from '../quotation-requirements'
import { ProjectModal } from '@/app/dashboard/projects/project-modal'

type TabId = 'overview' | 'requirements'

const STATUS_OPTIONS: QuotationStatus[] = [
  'draft',
  'sent',
  'under_discussion',
  'approved',
  'rejected',
  'expired',
]

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  under_discussion: 'Under Discussion',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
}

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: 'border-slate-300 bg-slate-100 text-slate-700',
  sent: 'border-blue-300 bg-blue-100 text-blue-700',
  under_discussion: 'border-amber-300 bg-amber-100 text-amber-800',
  approved: 'border-emerald-300 bg-emerald-100 text-emerald-700',
  rejected: 'border-rose-300 bg-rose-100 text-rose-700',
  expired: 'border-orange-300 bg-orange-100 text-orange-700',
  converted: 'border-violet-300 bg-violet-100 text-violet-700',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function parseDateOnly(d: string | null) {
  if (!d) return null
  const parsed = new Date(`${d}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount)
}

interface QuotationDetailViewProps {
  quotation: Quotation
  requirements: QuotationRequirement[]
  subtotal: number
  discount: number
  finalTotal: number
  canWrite: boolean
  isAdmin: boolean
  canCreateLead?: boolean
  leads: LeadSelectOption[]
  clients: ClientSelectOption[]
  technologyTools: TechnologyTool[]
  technologyToolsError?: string | null
  teamMembers: StaffSelectOption[]
  canViewAmount: boolean
}

export function QuotationDetailView({
  quotation,
  requirements,
  subtotal,
  discount,
  finalTotal,
  canWrite,
  isAdmin,
  canCreateLead = false,
  leads,
  clients,
  technologyTools,
  technologyToolsError = null,
  teamMembers,
  canViewAmount,
}: QuotationDetailViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { success: showSuccess, error: showError } = useToast()
  const tabParam = searchParams.get('tab')
  const tab: TabId = tabParam === 'requirements' ? 'requirements' : 'overview'
  const setTab = useCallback(
    (t: TabId) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', t)
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [convertConfirmOpen, setConvertConfirmOpen] = useState(false)
  const [conversionLoading, setConversionLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [termsValue, setTermsValue] = useState(quotation.terms ?? '')
  const [supportValue, setSupportValue] = useState(quotation.support ?? '')
  const [termsSaving, setTermsSaving] = useState(false)
  const [supportSaving, setSupportSaving] = useState(false)

  useEffect(() => {
    setTermsValue(quotation.terms ?? '')
    setSupportValue(quotation.support ?? '')
  }, [quotation.id, quotation.terms, quotation.support])

  const isConverted = quotation.status === 'converted'
  const canConvert = canWrite && quotation.status === 'approved'
  const showConvert = canConvert && !isConverted
  const canEditNotes = canWrite && !isConverted
  const termsDirty = termsValue.trim() !== (quotation.terms ?? '').trim()
  const supportDirty = supportValue.trim() !== (quotation.support ?? '').trim()

  const handleEditSubmit = async (formData: QuotationFormData) => {
    if (!canWrite) return { error: 'No permission' }
    setEditLoading(true)
    const result = await updateQuotation(quotation.id, formData)
    setEditLoading(false)
    if (!result.error) {
      showSuccess('Quotation Updated', 'Changes have been saved.')
      setEditModalOpen(false)
      router.refresh()
    } else {
      showError('Update Failed', result.error)
    }
    return result
  }

  const handleStatusChange = async (newStatus: QuotationStatus) => {
    if (!canWrite) return
    if (newStatus === quotation.status) {
      setStatusModalOpen(false)
      return
    }
    const result = await changeQuotationStatus(quotation.id, newStatus)
    if (!result.error) {
      showSuccess('Status Updated', `Status set to ${STATUS_LABELS[newStatus]}.`)
      setStatusModalOpen(false)
      router.refresh()
    } else {
      showError('Failed', result.error)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!isAdmin) return
    const result = await deleteQuotation(quotation.id)
    if (!result.error) {
      showSuccess('Quotation Deleted', 'The quotation has been removed.')
      router.push('/dashboard/quotations')
      router.refresh()
    } else {
      showError('Delete Failed', result.error)
    }
  }

  const handleSaveTerms = async () => {
    if (!canEditNotes || termsSaving) return
    setTermsSaving(true)
    const result = await updateQuotationTermsSupport(quotation.id, {
      terms: termsValue,
      support: quotation.support ?? '',
    })
    setTermsSaving(false)
    if (!result.error) {
      showSuccess('Saved', 'Terms updated successfully.')
      router.refresh()
    } else {
      showError('Failed', result.error)
    }
  }

  const handleSaveSupport = async () => {
    if (!canEditNotes || supportSaving) return
    setSupportSaving(true)
    const result = await updateQuotationTermsSupport(quotation.id, {
      terms: quotation.terms ?? '',
      support: supportValue,
    })
    setSupportSaving(false)
    if (!result.error) {
      showSuccess('Saved', 'Support updated successfully.')
      router.refresh()
    } else {
      showError('Failed', result.error)
    }
  }

  const handleConvertClick = async () => {
    if (!canConvert) return
    setConversionLoading(true)
    const start = await startQuotationConversion(quotation.id)
    setConversionLoading(false)
    if (start.error) {
      showError('Cannot Convert', start.error)
      return
    }
    const { data: latestClients } = await getClientsForSelect()
    setConversionClients(latestClients ?? [])
    const defaultDeadline = new Date()
    defaultDeadline.setDate(defaultDeadline.getDate() + 30)
    const initialData: Partial<ProjectFormData> = {
      client_id: start.client_id,
      project_amount: quotation.final_total,
      technology_tool_ids: quotation.technology_tools?.map((t) => t.id) ?? [],
      name: `Project from ${quotation.quotation_number}`,
      client_deadline_date: defaultDeadline.toISOString().slice(0, 10),
    }
    setProjectModalOpen(true)
    setConversionQuotationId(quotation.id)
    setProjectInitialData(initialData)
  }

  const handleDownloadPdf = async () => {
    if (pdfDownloading) return
    setPdfDownloading(true)
    try {
      await downloadQuotationPdf(quotation.id, `${quotation.quotation_number}.pdf`)
    } catch {
      showError('Download Failed', 'Unable to download quotation PDF right now.')
    } finally {
      setPdfDownloading(false)
    }
  }

  const [conversionQuotationId, setConversionQuotationId] = useState<string | null>(null)
  const [projectInitialData, setProjectInitialData] = useState<Partial<ProjectFormData> | null>(null)
  const [conversionClients, setConversionClients] = useState<ClientSelectOption[]>([])

  const handleProjectSubmitFromConversion = async (formData: ProjectFormData) => {
    const result = await createProject(formData)
    if (result.error || !result.data) return result
    const projectId = (result.data as { id: string }).id
    if (conversionQuotationId) {
      const complete = await completeQuotationConversion(conversionQuotationId, projectId)
      if (complete.error) {
        showError('Conversion Incomplete', complete.error)
        return result
      }
      showSuccess('Quotation Converted', 'Project created and requirements transferred.')
      setProjectModalOpen(false)
      setConversionQuotationId(null)
      setProjectInitialData(null)
      router.refresh()
      router.push(`/dashboard/projects/${projectId}`)
    }
    return result
  }

  const editInitialData: Partial<QuotationFormData> = {
    source_type: quotation.source_type,
    lead_id: quotation.lead_id ?? undefined,
    client_id: quotation.client_id ?? undefined,
    valid_till: quotation.valid_till ?? undefined,
    title: quotation.title ?? undefined,
    notes: quotation.notes ?? undefined,
    reference: quotation.reference ?? undefined,
    status: quotation.status,
    discount: quotation.discount,
    technology_tool_ids: quotation.technology_tools?.map((t) => t.id),
  }

  const sourceLabel = quotation.source_type === 'client' ? 'Client' : 'Lead'
  const sourceName =
    quotation.source_type === 'client'
      ? quotation.client?.name || quotation.client_snapshot_name || '—'
      : quotation.client_snapshot_name || quotation.lead?.name || '—'
  const sourceCompany =
    quotation.source_type === 'client'
      ? quotation.client?.company_name || quotation.client_snapshot_company_name || null
      : quotation.client_snapshot_company_name || quotation.lead?.company_name || null
  const sourcePhone =
    quotation.source_type === 'client'
      ? quotation.client?.phone || quotation.client_snapshot_phone || null
      : quotation.client_snapshot_phone || quotation.lead?.phone || null
  const sourceEmail = quotation.client_snapshot_email || null
  const sourceRemark = quotation.client_snapshot_remark || null
  const toolNames = quotation.technology_tools?.map((tool) => tool.name) ?? []
  const validTillDate = parseDateOnly(quotation.valid_till)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isValidTillExpired = validTillDate ? validTillDate.getTime() < today.getTime() : false
  const validTillBadgeClass = validTillDate
    ? isValidTillExpired
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-800'
    : 'border-slate-200 bg-slate-50 text-slate-600'

  return (
    <div className="flex h-full flex-col gap-2 sm:gap-3">
      <div className="flex-shrink-0 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xl font-black text-white shadow-lg">
                Q
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className="truncate text-xl font-extrabold tracking-tight text-[#1E1B4B] sm:text-2xl"
                    title={quotation.quotation_number}
                  >
                    {quotation.quotation_number}
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[quotation.status]}`}
                  >
                    {STATUS_LABELS[quotation.status]}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${validTillBadgeClass}`}>
                    Valid Till {formatDate(quotation.valid_till)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                    {sourceLabel} Quotation
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <Tooltip content="Download quotation PDF">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={pdfDownloading}
                  className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-emerald-50 hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Download quotation PDF"
                >
                  {pdfDownloading ? (
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v11m0 0l4-4m-4 4l-4-4M5 17v1a2 2 0 002 2h10a2 2 0 002-2v-1" />
                    </svg>
                  )}
                </button>
              </Tooltip>
              {canWrite && !isConverted && (
                <>
                  <Tooltip content="Edit quotation">
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(true)}
                      className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-1"
                      aria-label="Edit quotation"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </Tooltip>
                  <Tooltip content="Change status">
                    <button
                      type="button"
                      onClick={() => setStatusModalOpen(true)}
                      className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-cyan-50 hover:text-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-1"
                      aria-label="Change quotation status"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10m-10 6h6" />
                      </svg>
                    </button>
                  </Tooltip>
                </>
              )}
              {showConvert && (
                <Tooltip content="Convert to project">
                  <button
                    type="button"
                    onClick={() => setConvertConfirmOpen(true)}
                    disabled={conversionLoading}
                    className="rounded-lg p-2 text-teal-600 transition-colors duration-200 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Convert quotation to project"
                  >
                    {conversionLoading ? (
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5h6a2 2 0 012 2v2M9 19h6a2 2 0 002-2v-2M9 19a2 2 0 01-2-2v-2m0-4V7a2 2 0 012-2m0 0L7 3m2 2l2 2"
                        />
                      </svg>
                    )}
                  </button>
                </Tooltip>
              )}
              {isAdmin && !isConverted && (
                <Tooltip content="Delete quotation">
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(true)}
                    className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:ring-offset-1"
                    aria-label="Delete quotation"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Requirements</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{requirements.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Subtotal</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{formatCurrency(subtotal)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Discount</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{formatCurrency(discount)}</p>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/80 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">Estimated Total</p>
              <p className="mt-1 text-xl font-extrabold text-cyan-900">{formatCurrency(finalTotal)}</p>
            </div>
          </div>

          <div className="flex items-stretch overflow-x-auto scrollbar-hide" role="tablist" aria-label="Quotation detail tabs">
            {(['overview', 'requirements'] as TabId[]).map((tabId, index, list) => {
              const isActive = tab === tabId
              const isLast = index === list.length - 1

              return (
                <div key={tabId} className="flex items-stretch">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setTab(tabId)}
                    className={`
                      relative whitespace-nowrap border-b-2 px-2.5 pb-2 pt-1 text-sm font-semibold transition-colors duration-200
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white
                      ${isActive
                        ? 'border-[#06B6D4] text-[#06B6D4]'
                        : 'border-transparent text-slate-600 hover:text-slate-800'}
                    `}
                  >
                    {tabId === 'overview' ? 'Overview' : 'Requirements'}
                  </button>
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className="mx-2 w-px self-stretch bg-gradient-to-b from-slate-200/0 via-slate-200/70 to-slate-200/0 sm:mx-3"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div
        className={
          tab === 'overview'
            ? 'min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4'
            : 'min-h-0 flex-1'
        }
      >
        {tab === 'overview' && (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-3 py-2.5">
                <h2 className="text-sm font-bold text-slate-900">Quotation Information</h2>
              </div>
              <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Title</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">
                    {quotation.title || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Quotation Date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(quotation.created_at)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Last Updated</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(quotation.updated_at)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Valid Till</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(quotation.valid_till)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Reference</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-900">{quotation.reference || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">
                    {quotation.notes || '—'}
                  </p>
                </div>
                <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Technology & Tools</p>
                  {toolNames.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {toolNames.map((name, index) => (
                        <span
                          key={`${name}-${index}`}
                          className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No technology tools selected.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-3 py-2.5">
                <h2 className="text-sm font-bold text-slate-900">{sourceLabel} Details</h2>
              </div>
              <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Name</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-900">{sourceName}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Company</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-900">{sourceCompany || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Phone</p>
                  {sourcePhone ? (
                    <a
                      href={`tel:${sourcePhone}`}
                      className="mt-1 inline-flex text-sm font-semibold text-[#06B6D4] transition-colors hover:text-[#0891b2]"
                    >
                      {sourcePhone}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-slate-900">—</p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-900">{sourceEmail || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Remark</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">{sourceRemark || '—'}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 pt-1 lg:col-span-2 lg:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <label htmlFor="quotation-terms" className="text-base font-bold text-black">
                    Terms
                  </label>
                  {canEditNotes && (
                    <button
                      type="button"
                      onClick={handleSaveTerms}
                      disabled={!termsDirty || termsSaving}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-white transition-colors hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={termsSaving ? 'Saving terms' : 'Save terms'}
                      title={termsSaving ? 'Saving...' : 'Save'}
                    >
                      {termsSaving ? (
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  id="quotation-terms"
                  value={termsValue}
                  onChange={(e) => setTermsValue(e.target.value)}
                  readOnly={!canEditNotes}
                  rows={7}
                  placeholder="Add quotation terms..."
                  className="mt-2 block w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 read-only:cursor-default read-only:bg-slate-50"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <label htmlFor="quotation-support" className="text-base font-bold text-black">
                    Support
                  </label>
                  {canEditNotes && (
                    <button
                      type="button"
                      onClick={handleSaveSupport}
                      disabled={!supportDirty || supportSaving}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-white transition-colors hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={supportSaving ? 'Saving support' : 'Save support'}
                      title={supportSaving ? 'Saving...' : 'Save'}
                    >
                      {supportSaving ? (
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  id="quotation-support"
                  value={supportValue}
                  onChange={(e) => setSupportValue(e.target.value)}
                  readOnly={!canEditNotes}
                  rows={7}
                  placeholder="Add support details..."
                  className="mt-2 block w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 read-only:cursor-default read-only:bg-slate-50"
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'requirements' && (
          <QuotationRequirements
            quotationId={quotation.id}
            canWrite={canWrite && !isConverted}
            canViewAmount={canViewAmount}
            className="h-full"
            isActiveTab={tab === 'requirements'}
          />
        )}
      </div>

      <QuotationModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        mode="edit"
        initialData={editInitialData}
        onSubmit={handleEditSubmit}
        isLoading={editLoading}
        canCreateLead={canCreateLead}
        leads={leads}
        clients={clients}
        technologyTools={technologyTools}
        technologyToolsError={technologyToolsError}
      />

      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Change Status</h3>
            <div className="space-y-2">
              {STATUS_OPTIONS.filter((s) => s !== 'converted').map((s) => {
                const isCurrent = s === quotation.status
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleStatusChange(s)}
                    className={`w-full rounded-lg border px-4 py-2 text-left text-sm font-medium transition-colors ${
                      isCurrent
                        ? 'border-cyan-300 bg-cyan-50 text-cyan-800'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                    aria-current={isCurrent ? 'true' : undefined}
                  >
                    <span className="flex items-center justify-between">
                      <span>{STATUS_LABELS[s]}</span>
                      {isCurrent ? <span className="text-xs font-semibold">Current</span> : null}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setStatusModalOpen(false)}
              className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-[#1E1B4B]">Delete Quotation</h2>
            </div>
            <div className="px-6 py-6">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete quotation{' '}
                <span className="font-semibold">{quotation.quotation_number}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {convertConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-[#1E1B4B]">Convert to Project</h2>
            </div>
            <div className="px-6 py-6 space-y-3">
              <p className="text-sm text-gray-700">
                You are about to convert quotation{' '}
                <span className="font-semibold">{quotation.quotation_number}</span> into a project.
              </p>
              {quotation.source_type === 'lead' ? (
                <p className="text-sm text-gray-600">
                  This quotation is linked to a <span className="font-semibold">Lead</span>. A new client will be created
                  from the quotation&apos;s client information, then a project will be created and all requirements will be
                  transferred.
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  This quotation is linked to a <span className="font-semibold">Client</span>. A project will be created for
                  this client and all quotation requirements will be transferred.
                </p>
              )}
              <p className="text-xs text-amber-600">
                After conversion, this quotation will be marked as <span className="font-semibold">Converted</span> and can
                no longer be edited.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => !conversionLoading && setConvertConfirmOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                disabled={conversionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (conversionLoading) return
                  await handleConvertClick()
                  setConvertConfirmOpen(false)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={conversionLoading}
              >
                {conversionLoading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
                  </svg>
                )}
                <span>Convert to Project</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {projectModalOpen && projectInitialData && (
        <ProjectModal
          isOpen={projectModalOpen}
          onClose={() => {
            setProjectModalOpen(false)
            setConversionQuotationId(null)
            setProjectInitialData(null)
          }}
          mode="create"
          initialData={projectInitialData}
          onSubmit={handleProjectSubmitFromConversion}
          clients={conversionClients.length > 0 ? conversionClients : clients}
          clientsError={null}
          canViewAmount={canViewAmount}
          technologyTools={technologyTools}
          technologyToolsError={null}
          teamMembers={teamMembers}
          teamMembersError={null}
          selectedClientId={projectInitialData.client_id ?? ''}
        />
      )}
    </div>
  )
}
