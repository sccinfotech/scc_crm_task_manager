'use client'

import { useCallback, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { QuotationsTable } from './quotations-table'
import { QuotationFilters, type QuotationSortField } from './quotation-filters'
import { QuotationModal } from './quotation-modal'
import { SidebarToggleButton } from '@/app/components/dashboard/sidebar-context'
import { Pagination } from '@/app/components/ui/pagination'
import {
  createQuotation,
  getQuotationsPage,
  type QuotationListItem,
  type QuotationStatus,
  type QuotationSourceType,
  type QuotationFormData,
} from '@/lib/quotations/actions'
import { getLeadsForSelect, type LeadSelectOption } from '@/lib/leads/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'
import { useToast } from '@/app/components/ui/toast-context'

interface QuotationsClientProps {
  quotations: QuotationListItem[]
  totalCount: number
  page: number
  pageSize: number
  initialSearch: string
  initialStatus: QuotationStatus | 'all'
  initialSourceType: QuotationSourceType | 'all'
  initialDateFrom: string
  initialDateTo: string
  initialSortField: string
  initialSortDirection: 'asc' | 'desc'
  canWrite: boolean
  isAdmin: boolean
  canCreateLead?: boolean
  leads: LeadSelectOption[]
  clients: ClientSelectOption[]
  technologyTools: TechnologyTool[]
  technologyToolsError?: string | null
}

export function QuotationsClient({
  quotations,
  totalCount,
  page,
  pageSize,
  initialSearch,
  initialStatus,
  initialSourceType,
  initialDateFrom,
  initialDateTo,
  initialSortField,
  initialSortDirection,
  canWrite,
  canCreateLead = false,
  leads,
  clients,
  technologyTools,
  technologyToolsError = null,
}: QuotationsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { success: showSuccess, error: showError } = useToast()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const safeLeads = Array.isArray(leads) ? leads : []
  const [leadsForForm, setLeadsForForm] = useState<LeadSelectOption[]>(safeLeads)
  const [preselectedLeadOrClient, setPreselectedLeadOrClient] = useState<string | null>(null)

  useEffect(() => {
    setLeadsForForm(Array.isArray(leads) ? leads : [])
  }, [leads])
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>(initialStatus)
  const [sourceFilter, setSourceFilter] = useState<QuotationSourceType | 'all'>(initialSourceType)
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)
  const [sortField, setSortField] = useState<QuotationSortField>(
    initialSortField as QuotationSortField
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection)

  const buildSearchParams = useCallback(
    (updates: {
      search?: string
      status?: QuotationStatus | 'all'
      source?: QuotationSourceType | 'all'
      dateFrom?: string
      dateTo?: string
      sort?: QuotationSortField
      sortDir?: 'asc' | 'desc'
      page?: number
    }) => {
      const params = new URLSearchParams()
      const search = updates.search !== undefined ? updates.search : searchQuery
      const status = updates.status !== undefined ? updates.status : statusFilter
      const source = updates.source !== undefined ? updates.source : sourceFilter
      const from = updates.dateFrom !== undefined ? updates.dateFrom : dateFrom
      const to = updates.dateTo !== undefined ? updates.dateTo : dateTo
      const sort = updates.sort !== undefined ? updates.sort : sortField
      const sortDir = updates.sortDir !== undefined ? updates.sortDir : sortDirection
      const pageNum = updates.page !== undefined ? updates.page : page
      if (search) params.set('search', search)
      if (status && status !== 'all') params.set('status', status)
      if (source && source !== 'all') params.set('source', source)
      if (from) params.set('dateFrom', from)
      if (to) params.set('dateTo', to)
      if (sort) {
        params.set('sort', sort)
        params.set('sortDir', sortDir)
      }
      if (pageNum > 1) params.set('page', String(pageNum))
      return params.toString()
    },
    [searchQuery, statusFilter, sourceFilter, dateFrom, dateTo, sortField, sortDirection, page]
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

  const handleDateFromChange = (v: string) => {
    setDateFrom(v)
    router.push(`${pathname}?${buildSearchParams({ dateFrom: v, page: 1 })}`)
  }

  const handleDateToChange = (v: string) => {
    setDateTo(v)
    router.push(`${pathname}?${buildSearchParams({ dateTo: v, page: 1 })}`)
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setSourceFilter('all')
    setDateFrom('')
    setDateTo('')
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

  const isFiltered =
    statusFilter !== 'all' ||
    sourceFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== ''

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
            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
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
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={handleDateFromChange}
            onDateToChange={handleDateToChange}
            onClearFilters={handleClearFilters}
          />

          <div className="flex-1 overflow-y-auto">
            <div className="hidden md:block h-full">
              <QuotationsTable
                quotations={quotations}
                canWrite={canWrite}
                onView={(id) => router.push(`/dashboard/quotations/${id}`)}
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
    </>
  )
}
