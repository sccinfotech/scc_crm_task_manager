'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LeadsTable } from './leads-table'
import { LeadsCardList } from './leads-card-list'
import { LeadModal } from './lead-modal'
import { LeadDetails } from './lead-details'
import { DeleteConfirmModal } from './delete-confirm-modal'
import { LeadsFilters } from './leads-filters'
import { Pagination } from '@/app/components/ui/pagination'
import { createLead, updateLead, getLead, deleteLead, getLeadsPage, LeadFormData, Lead, LeadStatus, type LeadListItem, type FollowUpDateFilter, type LeadSortField } from '@/lib/leads/actions'
import { createClient, ClientFormData } from '@/lib/clients/actions'
import { useToast } from '@/app/components/ui/toast-context'
import { ClientModal } from '../clients/client-modal'

type FollowUpDateFilterType = FollowUpDateFilter

interface LeadsClientProps {
  leads: LeadListItem[]
  totalCount: number
  page: number
  pageSize: number
  initialSearch: string
  initialStatus: LeadStatus | 'all'
  initialFollowUpDate: FollowUpDateFilterType
  initialSortField: LeadSortField | null
  initialSortDirection: 'asc' | 'desc'
  canWrite: boolean
  canCreateClient?: boolean
}

export function LeadsClient({
  leads,
  totalCount,
  page,
  pageSize,
  initialSearch,
  initialStatus,
  initialFollowUpDate,
  initialSortField,
  initialSortDirection,
  canWrite,
  canCreateClient = false,
}: LeadsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { success: showSuccess, error: showError } = useToast()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [deleteLeadName, setDeleteLeadName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Mobile: accumulated list for infinite scroll (desktop uses server-driven page)
  const [mobileLeads, setMobileLeads] = useState<LeadListItem[]>(leads)
  const [mobilePage, setMobilePage] = useState(page)
  const [loadingMore, setLoadingMore] = useState(false)

  // Sync mobile list when filters/sort/page change (e.g. new search from server)
  useEffect(() => {
    setMobileLeads(leads)
    setMobilePage(page)
  }, [leads, page, initialSearch, initialStatus, initialFollowUpDate, initialSortField, initialSortDirection])

  const buildSearchParams = useCallback(
    (updates: {
      search?: string
      status?: string
      followUp?: string
      sort?: string | null
      sortDir?: string
      page?: number
    }) => {
      const params = new URLSearchParams()
      const search = updates.search !== undefined ? updates.search : initialSearch
      const status = updates.status !== undefined ? updates.status : initialStatus
      const followUp = updates.followUp !== undefined ? updates.followUp : initialFollowUpDate
      const sort = updates.sort !== undefined ? updates.sort : initialSortField
      const sortDir = updates.sortDir !== undefined ? updates.sortDir : initialSortDirection
      const pageNum = updates.page !== undefined ? updates.page : page
      if (search) params.set('search', search)
      if (status && status !== 'all') params.set('status', status)
      if (followUp && followUp !== 'all') params.set('followUp', followUp)
      if (sort) {
        params.set('sort', sort)
        params.set('sortDir', sortDir)
      }
      if (pageNum > 1) params.set('page', String(pageNum))
      return params.toString()
    },
    [initialSearch, initialStatus, initialFollowUpDate, initialSortField, initialSortDirection, page]
  )

  const handleSort = (field: LeadSortField | null) => {
    if (!field) {
      router.push(`${pathname}?${buildSearchParams({ sort: null, sortDir: undefined, page: 1 })}`)
      return
    }
    const nextDir =
      initialSortField === field
        ? initialSortDirection === 'asc'
          ? 'desc'
          : 'asc'
        : 'asc'
    const nextSort = initialSortField === field && initialSortDirection === 'desc' ? null : field
    router.push(
      `${pathname}?${buildSearchParams({
        sort: nextSort ?? undefined,
        sortDir: nextSort ? nextDir : undefined,
        page: 1,
      })}`
    )
  }

  const handleCreate = async (formData: LeadFormData) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to create leads.')
      return { error: 'Permission denied' }
    }
    setLoading(true)
    const result = await createLead(formData)
    setLoading(false)
    if (!result.error) {
      showSuccess('Lead Created', `Lead for ${formData.name} has been created successfully.`)
      router.refresh()
    } else {
      showError('Creation Failed', result.error)
    }
    return result
  }

  const handleUpdate = async (formData: LeadFormData) => {
    if (!selectedLeadId) return { error: 'No lead selected' }
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to update leads.')
      return { error: 'Permission denied' }
    }
    setLoading(true)
    const result = await updateLead(selectedLeadId, formData)
    setLoading(false)
    if (!result.error) {
      showSuccess('Lead Updated', `Information for ${formData.name} has been saved.`)
      router.refresh()
      // If details view is open, refresh the lead data
      if (detailsModalOpen && selectedLeadId) {
        const updatedResult = await getLead(selectedLeadId)
        if (updatedResult.data) {
          setSelectedLead(updatedResult.data)
        }
      }
    } else {
      showError('Update Failed', result.error)
    }
    return result
  }

  const handleView = (leadId: string) => {
    // Navigate to the lead detail page route
    router.push(`/dashboard/leads/${leadId}`)
  }

  const handleEdit = async (leadId: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to edit leads.')
      return
    }
    setLoading(true)
    const result = await getLead(leadId)
    setLoading(false)
    if (result.data) {
      setSelectedLead(result.data)
      setSelectedLeadId(leadId)
      setEditModalOpen(true)
    } else {
      showError('Error', result.error || 'Failed to load lead for editing')
    }
  }

  const handleEditFromDetails = () => {
    // Don't close details view, just open edit modal on top
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to edit leads.')
      return
    }
    if (selectedLeadId) {
      setEditModalOpen(true)
    }
  }

  const handleCloseEdit = () => {
    setEditModalOpen(false)
    // Only clear selectedLead/selectedLeadId if details view is not open
    if (!detailsModalOpen) {
      setSelectedLeadId(null)
      setSelectedLead(null)
    }
  }

  const handleCloseDetails = () => {
    setDetailsModalOpen(false)
    setSelectedLead(null)
    setSelectedLeadId(null)
  }

  const handleDelete = (leadId: string, leadName: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to delete leads.')
      return
    }
    setSelectedLeadId(leadId)
    setDeleteLeadName(leadName)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedLeadId) return
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to delete leads.')
      return
    }

    setDeleting(true)
    const result = await deleteLead(selectedLeadId)
    setDeleting(false)

    if (!result.error) {
      showSuccess('Lead Deleted', `${deleteLeadName} has been removed successfully.`)
      setDeleteModalOpen(false)
      setSelectedLeadId(null)
      setDeleteLeadName('')
      router.refresh()
    } else {
      showError('Delete Failed', result.error || 'Failed to delete lead')
    }
  }

  const handleCloseDelete = () => {
    setDeleteModalOpen(false)
    setSelectedLeadId(null)
    setDeleteLeadName('')
  }

  const canEditLead = () => canWrite
  const canConvert = canCreateClient && canWrite

  const getInitialEditData = (): Partial<LeadFormData> | undefined => {
    if (!selectedLead) return undefined
    return {
      name: selectedLead.name,
      company_name: selectedLead.company_name || undefined,
      phone: selectedLead.phone,
      source: selectedLead.source || undefined,
      status: selectedLead.status,
      follow_up_date: selectedLead.follow_up_date || undefined,
      notes: selectedLead.notes || undefined,
    }
  }

  const handleFilterChange = useCallback(
    (updates: { search?: string; status?: LeadStatus | 'all'; followUp?: FollowUpDateFilterType }) => {
      const q = buildSearchParams({
        ...updates,
        page: 1,
      })
      router.push(`${pathname}${q ? `?${q}` : ''}`)
    },
    [buildSearchParams, pathname, router]
  )

  const handleClearFilters = useCallback(() => {
    router.push(pathname)
  }, [pathname, router])

  const handlePageChange = (newPage: number) => {
    const q = buildSearchParams({ page: newPage })
    router.push(`${pathname}${q ? `?${q}` : ''}`)
  }

  const handleRefresh = () => {
    router.refresh()
  }

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || mobileLeads.length >= totalCount) return
    setLoadingMore(true)
    const result = await getLeadsPage({
      search: initialSearch || undefined,
      status: initialStatus !== 'all' ? initialStatus : undefined,
      followUpDate: initialFollowUpDate !== 'all' ? initialFollowUpDate : undefined,
      sortField: initialSortField ?? undefined,
      sortDirection: initialSortDirection,
      page: mobilePage + 1,
      pageSize,
    })
    setLoadingMore(false)
    if (result.data?.length) {
      setMobileLeads((prev) => [...prev, ...result.data])
      setMobilePage((prev) => prev + 1)
    }
  }, [loadingMore, mobileLeads.length, totalCount, initialSearch, initialStatus, initialFollowUpDate, initialSortField, initialSortDirection, mobilePage, pageSize])

  const handleConvert = async (leadId: string) => {
    if (!canConvert) {
      showError('Permission Denied', 'You do not have permission to create clients.')
      return
    }
    setLoading(true)
    const result = await getLead(leadId)
    setLoading(false)
    if (result.data) {
      setLeadToConvert(result.data)
      setConvertModalOpen(true)
    } else {
      showError('Error', result.error || 'Failed to load lead for conversion')
    }
  }

  const handleConvertSubmit = async (formData: ClientFormData) => {
    if (!leadToConvert) return { error: 'No lead selected' }
    if (!canConvert) {
      showError('Permission Denied', 'You do not have permission to create clients.')
      return { error: 'Permission denied' }
    }
    setLoading(true)
    const result = await createClient({
      ...formData,
      lead_id: leadToConvert.id,
    })
    setLoading(false)
    if (!result.error) {
      showSuccess('Client Created', `Lead ${leadToConvert.name} has been converted to a client.`)
      setConvertModalOpen(false)
      setLeadToConvert(null)
      router.refresh()
    } else {
      showError('Conversion Failed', result.error)
    }
    return result
  }

  const getInitialConvertData = (): Partial<ClientFormData> | undefined => {
    if (!leadToConvert) return undefined
    return {
      name: leadToConvert.name,
      company_name: leadToConvert.company_name || undefined,
      phone: leadToConvert.phone,
      status: 'active',
      lead_id: leadToConvert.id,
    }
  }

  return (
    <>
      <div className="flex h-full flex-col p-4 lg:p-6">
        {/* Page Title, Refresh, and Create Lead Button */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#1E1B4B]">Leads</h1>
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
              onClick={() => setCreateModalOpen(true)}
              disabled={!canWrite}
              title={canWrite ? 'Create lead' : 'Read-only access'}
              className={`btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${!canWrite ? 'hover:shadow-lg hover:-translate-y-0' : ''}`}
            >
              Create Lead
            </button>
          </div>
        </div>

        {/* Full Height Table Container */}
        <div className="flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col">
          <LeadsFilters
            statusFilter={initialStatus}
            onStatusChange={(s) => handleFilterChange({ status: s })}
            searchQuery={initialSearch}
            onSearchChange={(q) => handleFilterChange({ search: q })}
            followUpDateFilter={initialFollowUpDate}
            onFollowUpDateChange={(f) => handleFilterChange({ followUp: f })}
            onClearFilters={handleClearFilters}
          />

          {loading && (
            <div className="border-b border-gray-200 bg-blue-50 px-6 py-3">
              <p className="text-sm text-blue-800">Loading...</p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {/* Mobile: card list with infinite scroll (only below md) */}
            <div className="md:hidden">
              <LeadsCardList
                leads={mobileLeads}
                canWrite={canWrite}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onConvert={handleConvert}
                canConvert={canConvert}
                isFiltered={initialStatus !== 'all' || initialSearch.trim() !== '' || initialFollowUpDate !== 'all'}
                hasMore={mobileLeads.length < totalCount}
                loadingMore={loadingMore}
                onLoadMore={handleLoadMore}
              />
            </div>
            {/* Desktop: table + pagination (md and up) */}
            <div className="hidden md:block h-full">
              <LeadsTable
                leads={leads}
                canWrite={canWrite}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onConvert={handleConvert}
                canConvert={canConvert}
                sortField={initialSortField}
                sortDirection={initialSortField ? initialSortDirection : undefined}
                onSort={handleSort}
                isFiltered={initialStatus !== 'all' || initialSearch.trim() !== '' || initialFollowUpDate !== 'all'}
              />
            </div>
          </div>
          <Pagination
            currentPage={page}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            className="hidden md:flex"
          />
        </div>
      </div>

      {/* Create Modal */}
      <LeadModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        mode="create"
        onSubmit={handleCreate}
      />

      {/* Edit Modal */}
      <LeadModal
        isOpen={editModalOpen}
        onClose={handleCloseEdit}
        mode="edit"
        initialData={getInitialEditData()}
        onSubmit={handleUpdate}
      />

      {/* Details Modal */}
      {selectedLead && detailsModalOpen && (
        <LeadDetails
          lead={selectedLead}
          onClose={handleCloseDetails}
          onEdit={handleEditFromDetails}
          onDelete={() => handleDelete(selectedLead.id, selectedLead.name)}
          canEdit={canEditLead()}
          canDelete={canEditLead()}
          canWrite={canWrite}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        leadName={deleteLeadName}
        isLoading={deleting}
      />

      {/* Convert to Client Modal */}
      {leadToConvert && (
        <ClientModal
          isOpen={convertModalOpen}
          onClose={() => {
            setConvertModalOpen(false)
            setLeadToConvert(null)
          }}
          mode="create"
          initialData={getInitialConvertData()}
          onSubmit={handleConvertSubmit}
        />
      )}
    </>
  )
}
