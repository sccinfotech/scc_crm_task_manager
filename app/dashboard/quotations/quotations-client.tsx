'use client'

import { useCallback, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { QuotationsTable } from './quotations-table'
import { QuotationFilters, type QuotationSortField } from './quotation-filters'
import { QuotationModal } from './quotation-modal'
import { SidebarToggleButton } from '@/app/components/dashboard/sidebar-context'
import { Pagination } from '@/app/components/ui/pagination'
import { Tooltip } from '@/app/components/ui/tooltip'
import { ProjectModal } from '@/app/dashboard/projects/project-modal'
import {
  createQuotation,
  deleteQuotation,
  getQuotation,
  changeQuotationStatus,
  updateQuotation,
  startQuotationConversion,
  completeQuotationConversion,
  type Quotation,
  type QuotationListItem,
  type QuotationStatus,
  type QuotationSourceType,
  type QuotationFormData,
} from '@/lib/quotations/actions'
import { createProject, type ProjectFormData } from '@/lib/projects/actions'
import { getLeadsForSelect, type LeadSelectOption } from '@/lib/leads/actions'
import { getClientsForSelect, type ClientSelectOption } from '@/lib/clients/actions'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'
import type { StaffSelectOption } from '@/lib/users/actions'
import { useToast } from '@/app/components/ui/toast-context'

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

interface QuotationsClientProps {
  quotations: QuotationListItem[]
  totalCount: number
  page: number
  pageSize: number
  initialSearch: string
  initialStatus: QuotationStatus | 'all'
  initialSourceType: QuotationSourceType | 'all'
  initialSortField: string
  initialSortDirection: 'asc' | 'desc'
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

export function QuotationsClient({
  quotations,
  totalCount,
  page,
  pageSize,
  initialSearch,
  initialStatus,
  initialSourceType,
  initialSortField,
  initialSortDirection,
  canWrite,
  isAdmin,
  canCreateLead = false,
  leads,
  clients,
  technologyTools,
  technologyToolsError = null,
  teamMembers,
  canViewAmount,
}: QuotationsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { success: showSuccess, error: showError } = useToast()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [convertConfirmOpen, setConvertConfirmOpen] = useState(false)
  const [conversionLoading, setConversionLoading] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null)
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [deleteQuotationNumber, setDeleteQuotationNumber] = useState('')
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusQuotationId, setStatusQuotationId] = useState<string | null>(null)
  const [statusQuotationNumber, setStatusQuotationNumber] = useState('')
  const [statusCurrent, setStatusCurrent] = useState<QuotationStatus | null>(null)
  const [conversionQuotationId, setConversionQuotationId] = useState<string | null>(null)
  const [conversionQuotationNumber, setConversionQuotationNumber] = useState('')
  const [conversionSourceType, setConversionSourceType] = useState<QuotationSourceType | null>(null)
  const [projectInitialData, setProjectInitialData] = useState<Partial<ProjectFormData> | null>(null)
  const [conversionClients, setConversionClients] = useState<ClientSelectOption[]>([])
  const safeLeads = Array.isArray(leads) ? leads : []
  const [leadsForForm, setLeadsForForm] = useState<LeadSelectOption[]>(safeLeads)
  const [preselectedLeadOrClient, setPreselectedLeadOrClient] = useState<string | null>(null)

  useEffect(() => {
    setLeadsForForm(Array.isArray(leads) ? leads : [])
  }, [leads])
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>(initialStatus)
  const [sourceFilter, setSourceFilter] = useState<QuotationSourceType | 'all'>(initialSourceType)
  const [sortField, setSortField] = useState<QuotationSortField>(
    initialSortField as QuotationSortField
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection)

  const buildSearchParams = useCallback(
    (updates: {
      search?: string
      status?: QuotationStatus | 'all'
      source?: QuotationSourceType | 'all'
      sort?: QuotationSortField
      sortDir?: 'asc' | 'desc'
      page?: number
    }) => {
      const params = new URLSearchParams()
      const search = updates.search !== undefined ? updates.search : searchQuery
      const status = updates.status !== undefined ? updates.status : statusFilter
      const source = updates.source !== undefined ? updates.source : sourceFilter
      const sort = updates.sort !== undefined ? updates.sort : sortField
      const sortDir = updates.sortDir !== undefined ? updates.sortDir : sortDirection
      const pageNum = updates.page !== undefined ? updates.page : page
      if (search) params.set('search', search)
      if (status && status !== 'all') params.set('status', status)
      if (source && source !== 'all') params.set('source', source)
      if (sort) {
        params.set('sort', sort)
        params.set('sortDir', sortDir)
      }
      if (pageNum > 1) params.set('page', String(pageNum))
      return params.toString()
    },
    [searchQuery, statusFilter, sourceFilter, sortField, sortDirection, page]
  )

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    router.push(`${pathname}?${buildSearchParams({ search: query, page: 1 })}`)
  }

  const handleStatusChange = (status: QuotationStatus | 'all') => {
    setStatusFilter(status)
    router.push(`${pathname}?${buildSearchParams({ status, page: 1 })}`)
  }

  const handleSourceChange = (source: QuotationSourceType | 'all') => {
    setSourceFilter(source)
    router.push(`${pathname}?${buildSearchParams({ source, page: 1 })}`)
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setSourceFilter('all')
    router.push(pathname || '/dashboard/quotations')
  }

  const handleSort = (field: QuotationSortField) => {
    if (!field) {
      router.push(`${pathname}?${buildSearchParams({ sort: undefined, sortDir: undefined, page: 1 })}`)
      setSortField(null)
      setSortDirection('desc')
      return
    }
    const nextDir =
      sortField === field ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc'
    setSortField(field)
    setSortDirection(nextDir)
    router.push(
      `${pathname}?${buildSearchParams({ sort: field, sortDir: nextDir, page: 1 })}`
    )
  }

  const handleCreate = async (formData: QuotationFormData) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to create quotations.')
      return { error: 'Permission denied' }
    }
    setLoading(true)
    const result = await createQuotation(formData)
    setLoading(false)
    if (!result.error && result.data) {
      showSuccess('Quotation Created', `Quotation ${result.data.quotation_number} has been created.`)
      setCreateModalOpen(false)
      router.refresh()
      router.push(`/dashboard/quotations/${result.data.id}`)
    } else {
      showError('Creation Failed', result.error ?? 'Failed to create quotation')
    }
    return result
  }

  const handleEdit = async (quotationId: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to edit quotations.')
      return
    }
    setSelectedQuotationId(quotationId)
    setEditModalOpen(true)
    setEditLoading(true)
    const result = await getQuotation(quotationId)
    setEditLoading(false)
    if (result.data) {
      setSelectedQuotation(result.data)
    } else {
      showError('Error', result.error || 'Failed to load quotation for editing')
      setEditModalOpen(false)
      setSelectedQuotationId(null)
      setSelectedQuotation(null)
    }
  }

  const handleUpdate = async (formData: QuotationFormData) => {
    if (!selectedQuotationId) return { error: 'No quotation selected' }
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to edit quotations.')
      return { error: 'Permission denied' }
    }
    setLoading(true)
    const result = await updateQuotation(selectedQuotationId, formData)
    setLoading(false)
    if (!result.error) {
      showSuccess('Quotation Updated', 'Quotation has been updated successfully.')
      setEditModalOpen(false)
      setSelectedQuotationId(null)
      setSelectedQuotation(null)
      router.refresh()
    } else {
      showError('Update Failed', result.error || 'Failed to update quotation')
    }
    return result
  }

  const handleDeleteOpen = (quotationId: string, quotationNumber: string) => {
    if (!isAdmin) {
      showError('Permission Denied', 'Only administrators can delete quotations.')
      return
    }
    setSelectedQuotationId(quotationId)
    setDeleteQuotationNumber(quotationNumber)
    setDeleteModalOpen(true)
  }

  const handleOpenStatusChange = (
    quotationId: string,
    quotationNumber: string,
    currentStatus: QuotationStatus
  ) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to change quotation status.')
      return
    }
    setStatusQuotationId(quotationId)
    setStatusQuotationNumber(quotationNumber)
    setStatusCurrent(currentStatus)
    setStatusModalOpen(true)
  }

  const closeStatusModal = () => {
    if (statusChanging) return
    setStatusModalOpen(false)
    setStatusQuotationId(null)
    setStatusQuotationNumber('')
    setStatusCurrent(null)
  }

  const handleStatusUpdate = async (nextStatus: QuotationStatus) => {
    if (!statusQuotationId) return
    if (statusCurrent === nextStatus) {
      closeStatusModal()
      return
    }
    setStatusChanging(true)
    const result = await changeQuotationStatus(statusQuotationId, nextStatus)
    setStatusChanging(false)
    if (!result.error) {
      showSuccess('Status Updated', `${statusQuotationNumber} set to ${STATUS_LABELS[nextStatus]}.`)
      closeStatusModal()
      router.refresh()
    } else {
      showError('Failed', result.error)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedQuotationId) return
    if (!isAdmin) {
      showError('Permission Denied', 'Only administrators can delete quotations.')
      return
    }
    setDeleting(true)
    const result = await deleteQuotation(selectedQuotationId)
    setDeleting(false)
    if (!result.error) {
      showSuccess('Quotation Deleted', `${deleteQuotationNumber} has been deleted.`)
      setDeleteModalOpen(false)
      setSelectedQuotationId(null)
      setDeleteQuotationNumber('')
      router.refresh()
    } else {
      showError('Delete Failed', result.error || 'Failed to delete quotation')
    }
  }

  const handleOpenConvert = (quotationId: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to convert quotations.')
      return
    }
    const q = quotations.find((item) => item.id === quotationId)
    if (!q) return
    if (q.status !== 'approved') {
      showError('Cannot Convert', 'Only an approved quotation can be converted.')
      return
    }
    setConversionQuotationId(quotationId)
    setConversionQuotationNumber(q.quotation_number)
    setConversionSourceType(q.source_type)
    setConvertConfirmOpen(true)
  }

  const handleConfirmConvert = async () => {
    if (!conversionQuotationId || !canWrite) return
    if (conversionLoading) return
    setConversionLoading(true)
    const start = await startQuotationConversion(conversionQuotationId)
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
      project_amount: start.quotation.final_total,
      technology_tool_ids: start.quotation.technology_tools?.map((t) => t.id) ?? [],
      name: `Project from ${start.quotation.quotation_number}`,
      client_deadline_date: defaultDeadline.toISOString().slice(0, 10),
    }
    setProjectInitialData(initialData)
    setProjectModalOpen(true)
    setConvertConfirmOpen(false)
  }

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
      setConversionQuotationNumber('')
      setConversionSourceType(null)
      router.refresh()
      router.push(`/dashboard/projects/${projectId}`)
    }
    return result
  }

  const isFiltered =
    statusFilter !== 'all' ||
    sourceFilter !== 'all' ||
    searchQuery.trim() !== ''

  const handleRefresh = () => {
    router.refresh()
  }

  const handleLeadCreated = useCallback((newLeadId: string) => {
    getLeadsForSelect().then((res) => {
      if (Array.isArray(res?.data)) setLeadsForForm(res.data)
      setPreselectedLeadOrClient(`lead:${newLeadId}`)
    })
  }, [])

  const handlePreselectedApplied = useCallback(() => {
    setPreselectedLeadOrClient(null)
  }, [])

  const handleCreateModalClose = useCallback(() => {
    setCreateModalOpen(false)
    setPreselectedLeadOrClient(null)
  }, [])

  return (
    <>
      <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SidebarToggleButton />
            <h1 className="text-2xl font-semibold text-[#1E1B4B]">Quotations</h1>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content="Refresh quotations">
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                aria-label="Refresh quotations"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              disabled={!canWrite}
              title={canWrite ? 'Create quotation' : 'Read-only access'}
              className={`btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${!canWrite ? 'hover:shadow-lg hover:-translate-y-0' : ''}`}
            >
              Add Quotation
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col">
          <QuotationFilters
            statusFilter={statusFilter}
            onStatusChange={handleStatusChange}
            sourceFilter={sourceFilter}
            onSourceChange={handleSourceChange}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onClearFilters={handleClearFilters}
          />

          <div className="flex-1 overflow-y-auto">
            <div className="hidden md:block h-full">
              <QuotationsTable
                quotations={quotations}
                canWrite={canWrite}
                canDelete={isAdmin}
                onView={(id) => router.push(`/dashboard/quotations/${id}`)}
                onChangeStatus={handleOpenStatusChange}
                onEdit={handleEdit}
                onDelete={handleDeleteOpen}
                onConvert={handleOpenConvert}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                isFiltered={isFiltered}
              />
            </div>
          </div>

          {totalCount > pageSize && (
            <Pagination
              currentPage={page}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={(newPage) =>
                router.push(`${pathname}?${buildSearchParams({ page: newPage })}`)
              }
              className="hidden md:flex"
            />
          )}
        </div>
      </div>

      <QuotationModal
        isOpen={createModalOpen}
        onClose={handleCreateModalClose}
        mode="create"
        onSubmit={handleCreate}
        isLoading={loading}
        leads={leadsForForm}
        clients={clients}
        technologyTools={technologyTools}
        technologyToolsError={technologyToolsError}
        canCreateLead={canCreateLead}
        onLeadCreated={handleLeadCreated}
        preselectedLeadOrClient={preselectedLeadOrClient}
        onPreselectedApplied={handlePreselectedApplied}
      />

      <QuotationModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditLoading(false)
          setSelectedQuotationId(null)
          setSelectedQuotation(null)
        }}
        mode="edit"
        initialData={
          selectedQuotation
            ? {
                source_type: selectedQuotation.source_type,
                lead_id: selectedQuotation.lead_id ?? undefined,
                client_id: selectedQuotation.client_id ?? undefined,
                valid_till: selectedQuotation.valid_till ?? undefined,
                reference: selectedQuotation.reference ?? undefined,
                status: selectedQuotation.status,
                discount: selectedQuotation.discount,
                technology_tool_ids: selectedQuotation.technology_tools?.map((tool) => tool.id),
              }
            : undefined
        }
        onSubmit={handleUpdate}
        isLoading={editLoading || loading}
        leads={leadsForForm}
        clients={clients}
        technologyTools={technologyTools}
        technologyToolsError={technologyToolsError}
        canCreateLead={canCreateLead}
      />

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
                <span className="font-semibold">{deleteQuotationNumber}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false)
                  setSelectedQuotationId(null)
                  setDeleteQuotationNumber('')
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-lg font-semibold text-slate-900">Change Status</h3>
            {statusQuotationNumber && (
              <p className="mb-3 text-sm text-slate-500">{statusQuotationNumber}</p>
            )}
            <div className="space-y-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusUpdate(status)}
                  disabled={statusChanging}
                  className={`w-full rounded-lg border px-4 py-2 text-left text-sm font-medium transition-colors ${
                    statusCurrent === status
                      ? 'border-cyan-300 bg-cyan-50 text-cyan-700'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={closeStatusModal}
              disabled={statusChanging}
              className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
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
                <span className="font-semibold">{conversionQuotationNumber}</span> into a project.
              </p>
              {conversionSourceType === 'lead' ? (
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
                onClick={handleConfirmConvert}
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
            setConversionQuotationNumber('')
            setConversionSourceType(null)
          }}
          mode="create"
          initialData={projectInitialData}
          onSubmit={handleProjectSubmitFromConversion}
          clients={conversionClients.length > 0 ? conversionClients : clients}
          clientsError={null}
          canViewAmount={canViewAmount}
          technologyTools={technologyTools}
          technologyToolsError={technologyToolsError ?? null}
          teamMembers={teamMembers}
          teamMembersError={null}
          selectedClientId={projectInitialData.client_id ?? ''}
        />
      )}
    </>
  )
}
