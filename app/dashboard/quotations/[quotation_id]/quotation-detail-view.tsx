'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/app/components/ui/toast-context'
import type { Quotation, QuotationRequirement, QuotationStatus } from '@/lib/quotations/actions'
import {
  updateQuotation,
  changeQuotationStatus,
  deleteQuotation,
  startQuotationConversion,
  completeQuotationConversion,
  createQuotationRequirement,
  type QuotationFormData,
} from '@/lib/quotations/actions'
import { createProject, type ProjectFormData } from '@/lib/projects/actions'
import { getClientsForSelect } from '@/lib/clients/actions'
import type { LeadSelectOption } from '@/lib/leads/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'
import type { StaffSelectOption } from '@/lib/users/actions'
import { QuotationModal } from '../quotation-modal'
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

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
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
  const tab = (searchParams.get('tab') as TabId) || 'overview'
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
  const [conversionLoading, setConversionLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  const isConverted = quotation.status === 'converted'
  const canConvert = canWrite && quotation.status === 'approved'
  const showConvert = canConvert && !isConverted

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

  const [conversionQuotationId, setConversionQuotationId] = useState<string | null>(null)
  const [projectInitialData, setProjectInitialData] = useState<Partial<ProjectFormData> | null>(null)
  const [conversionClients, setConversionClients] = useState<ClientSelectOption[]>([])
  const [addRequirementOpen, setAddRequirementOpen] = useState(false)
  const [reqDescription, setReqDescription] = useState('')
  const [reqAmount, setReqAmount] = useState('')
  const [addReqLoading, setAddReqLoading] = useState(false)

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

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number.parseFloat(reqAmount)
    if (Number.isNaN(amount) || amount < 0) {
      showError('Invalid amount', 'Please enter a valid amount.')
      return
    }
    setAddReqLoading(true)
    const result = await createQuotationRequirement(quotation.id, {
      requirement_type: 'initial',
      pricing_type: 'fixed',
      description: reqDescription.trim() || null,
      amount,
    })
    setAddReqLoading(false)
    if (!result.error) {
      showSuccess('Requirement Added', 'The requirement has been added.')
      setAddRequirementOpen(false)
      setReqDescription('')
      setReqAmount('')
      router.refresh()
    } else {
      showError('Failed', result.error)
    }
  }

  const editInitialData: Partial<QuotationFormData> = {
    source_type: quotation.source_type,
    lead_id: quotation.lead_id ?? undefined,
    client_id: quotation.client_id ?? undefined,
    valid_till: quotation.valid_till ?? undefined,
    reference: quotation.reference ?? undefined,
    status: quotation.status,
    discount: quotation.discount,
    technology_tool_ids: quotation.technology_tools?.map((t) => t.id),
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Top actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {STATUS_LABELS[quotation.status]}
          </span>
          {quotation.source_type && (
            <span className="text-sm text-slate-500 capitalize">{quotation.source_type}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && !isConverted && (
            <>
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setStatusModalOpen(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Change Status
              </button>
            </>
          )}
          {showConvert && (
            <button
              type="button"
              onClick={handleConvertClick}
              disabled={conversionLoading}
              className="rounded-lg bg-[#06B6D4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0891b2] disabled:opacity-50"
            >
              {conversionLoading ? 'Preparing…' : 'Convert'}
            </button>
          )}
          {isAdmin && !isConverted && (
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('overview')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'overview'
              ? 'border-[#06B6D4] text-[#06B6D4]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab('requirements')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'requirements'
              ? 'border-[#06B6D4] text-[#06B6D4]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Requirements
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Quotation Date</p>
                <p className="mt-1 font-medium text-slate-900">{formatDate(quotation.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Valid Till</p>
                <p className="mt-1 font-medium text-slate-900">{formatDate(quotation.valid_till)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Reference</p>
                <p className="mt-1 font-medium text-slate-900">{quotation.reference || '—'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500 mb-1">Technology & Tools</p>
              <p className="font-medium text-slate-900">
                {quotation.technology_tools?.length
                  ? quotation.technology_tools.map((t) => t.name).join(', ')
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Client Information</h4>
              {quotation.source_type === 'client' && quotation.client ? (
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <p><span className="text-slate-500">Name:</span> {quotation.client.name}</p>
                  <p><span className="text-slate-500">Company:</span> {quotation.client.company_name ?? '—'}</p>
                  <p><span className="text-slate-500">Phone:</span> {quotation.client.phone}</p>
                </div>
              ) : quotation.source_type === 'lead' && (quotation.client_snapshot_name || quotation.lead) ? (
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <p><span className="text-slate-500">Name:</span> {quotation.client_snapshot_name || quotation.lead?.name || '—'}</p>
                  <p><span className="text-slate-500">Company:</span> {quotation.client_snapshot_company_name ?? quotation.lead?.company_name ?? '—'}</p>
                  <p><span className="text-slate-500">Phone:</span> {quotation.client_snapshot_phone ?? quotation.lead?.phone ?? '—'}</p>
                  {quotation.client_snapshot_email && <p><span className="text-slate-500">Email:</span> {quotation.client_snapshot_email}</p>}
                  {quotation.client_snapshot_remark && <p className="sm:col-span-2"><span className="text-slate-500">Remark:</span> {quotation.client_snapshot_remark}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No client information.</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Totals</h4>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Discount</span>
                  <span className="font-medium">{formatCurrency(discount)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
                  <span>Final Total</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'requirements' && (
          <div className="space-y-4">
            {canWrite && !isConverted && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setAddRequirementOpen(true)}
                  className="rounded-lg bg-[#06B6D4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0891b2]"
                >
                  Add Requirement
                </button>
              </div>
            )}
            {requirements.length === 0 ? (
              <p className="text-slate-500 text-sm">No requirements added yet. Add at least one requirement before approving.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {requirements.map((req) => (
                  <li key={req.id} className="py-4 first:pt-0">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 mr-2">
                          {req.requirement_type}
                        </span>
                        <span className="text-sm text-slate-500">{req.pricing_type}</span>
                        {req.title && <p className="font-medium text-slate-900 mt-1">{req.title}</p>}
                        {req.description && <p className="text-sm text-slate-600 mt-1">{req.description}</p>}
                      </div>
                      {req.amount != null && (
                        <span className="font-medium text-slate-900 whitespace-nowrap">{formatCurrency(req.amount)}</span>
                      )}
                    </div>
                    {req.milestones && req.milestones.length > 0 && (
                      <ul className="mt-2 ml-4 space-y-1 text-sm text-slate-600">
                        {req.milestones.map((m) => (
                          <li key={m.id}>
                            {m.title}: {formatCurrency(m.amount)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
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
              {STATUS_OPTIONS.filter((s) => s !== 'converted').map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
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

      {addRequirementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Requirement</h3>
            <form onSubmit={handleAddRequirement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={reqDescription}
                  onChange={(e) => setReqDescription(e.target.value)}
                  rows={3}
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Requirement description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={reqAmount}
                  onChange={(e) => setReqAmount(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setAddRequirementOpen(false); setReqDescription(''); setReqAmount(''); }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addReqLoading}
                  className="rounded-lg bg-[#06B6D4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0891b2] disabled:opacity-50"
                >
                  {addReqLoading ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
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
