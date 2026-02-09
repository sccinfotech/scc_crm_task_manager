'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ClientsTable } from './clients-table'
import { ClientsCardList } from './clients-card-list'
import { ClientModal } from './client-modal'
import { DeleteConfirmModal } from './delete-confirm-modal'
import { ClientsFilters } from './clients-filters'
import { InternalNotesPanel } from './internal-notes-panel'
import { Pagination } from '@/app/components/ui/pagination'
import { createClient, updateClient, getClient, deleteClient, getClientsPage, ClientFormData, Client, ClientStatus, type ClientListItem, type ClientSortField } from '@/lib/clients/actions'
import { useToast } from '@/app/components/ui/toast-context'

interface ClientsClientProps {
  clients: ClientListItem[]
  totalCount: number
  page: number
  pageSize: number
  initialSearch: string
  initialStatus: ClientStatus | 'all'
  initialSortField: ClientSortField | null
  initialSortDirection: 'asc' | 'desc'
  canWrite: boolean
  canManageInternalNotes: boolean
}

export function ClientsClient({
  clients,
  totalCount,
  page,
  pageSize,
  initialSearch,
  initialStatus,
  initialSortField,
  initialSortDirection,
  canWrite,
  canManageInternalNotes,
}: ClientsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { success: showSuccess, error: showError } = useToast()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [deleteClientName, setDeleteClientName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [internalNotesOpen, setInternalNotesOpen] = useState(false)
  const [internalNotesClientId, setInternalNotesClientId] = useState<string | null>(null)
  const [internalNotesClientName, setInternalNotesClientName] = useState<string>('')
  // Mobile: accumulated list for infinite scroll (desktop uses server-driven page)
  const [mobileClients, setMobileClients] = useState<ClientListItem[]>(clients)
  const [mobilePage, setMobilePage] = useState(page)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    setMobileClients(clients)
    setMobilePage(page)
  }, [clients, page, initialSearch, initialStatus, initialSortField, initialSortDirection])

  const buildSearchParams = useCallback(
    (updates: {
      search?: string
      status?: string
      sort?: string | null
      sortDir?: string
      page?: number
    }) => {
      const params = new URLSearchParams()
      const search = updates.search !== undefined ? updates.search : initialSearch
      const status = updates.status !== undefined ? updates.status : initialStatus
      const sort = updates.sort !== undefined ? updates.sort : initialSortField
      const sortDir = updates.sortDir !== undefined ? updates.sortDir : initialSortDirection
      const pageNum = updates.page !== undefined ? updates.page : page
      if (search) params.set('search', search)
      if (status && status !== 'all') params.set('status', status)
      if (sort) {
        params.set('sort', sort)
        params.set('sortDir', sortDir)
      }
      if (pageNum > 1) params.set('page', String(pageNum))
      return params.toString()
    },
    [initialSearch, initialStatus, initialSortField, initialSortDirection, page]
  )

  const handleSort = (field: ClientSortField | null) => {
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

  const handleCreate = async (formData: ClientFormData) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to create clients.')
      return { error: 'Permission denied' }
    }
    setLoading(true)
    const result = await createClient(formData)
    setLoading(false)
    if (!result.error) {
      showSuccess('Client Created', `Client ${formData.name} has been created successfully.`)
      router.refresh()
    } else {
      showError('Creation Failed', result.error)
    }
    return result
  }

  const handleUpdate = async (formData: ClientFormData) => {
    if (!selectedClientId) return { error: 'No client selected' }
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to update clients.')
      return { error: 'Permission denied' }
    }
    setLoading(true)
    const result = await updateClient(selectedClientId, formData)
    setLoading(false)
    if (!result.error) {
      showSuccess('Client Updated', `Information for ${formData.name} has been saved.`)
      router.refresh()
    } else {
      showError('Update Failed', result.error)
    }
    return result
  }

  const handleView = (clientId: string) => {
    // Navigate to the client detail page route
    router.push(`/dashboard/clients/${clientId}`)
  }

  const handleEdit = async (clientId: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to edit clients.')
      return
    }
    setLoading(true)
    const result = await getClient(clientId)
    setLoading(false)
    if (result.data) {
      setSelectedClient(result.data)
      setSelectedClientId(clientId)
      setEditModalOpen(true)
    } else {
      showError('Error', result.error || 'Failed to load client for editing')
    }
  }

  const handleDelete = (clientId: string, clientName: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to delete clients.')
      return
    }
    setSelectedClientId(clientId)
    setDeleteClientName(clientName)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedClientId) return
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to delete clients.')
      return
    }

    setDeleting(true)
    const result = await deleteClient(selectedClientId)
    setDeleting(false)

    if (!result.error) {
      showSuccess('Client Deleted', `${deleteClientName} has been removed successfully.`)
      setDeleteModalOpen(false)
      setSelectedClientId(null)
      setDeleteClientName('')
      router.refresh()
    } else {
      showError('Delete Failed', result.error || 'Failed to delete client')
    }
  }

  const handleCloseDelete = () => {
    setDeleteModalOpen(false)
    setSelectedClientId(null)
    setDeleteClientName('')
  }

  const getInitialEditData = (): Partial<ClientFormData> | undefined => {
    if (!selectedClient) return undefined
    return {
      name: selectedClient.name,
      company_name: selectedClient.company_name || undefined,
      phone: selectedClient.phone,
      email: selectedClient.email || undefined,
      status: selectedClient.status,
      remark: selectedClient.remark || undefined,
    }
  }

  const handleFilterChange = (updates: { search?: string; status?: ClientStatus | 'all' }) => {
    const q = buildSearchParams({ ...updates, page: 1 })
    router.push(`${pathname}${q ? `?${q}` : ''}`)
  }

  const handleClearFilters = () => {
    router.push(pathname)
  }

  const handlePageChange = (newPage: number) => {
    const q = buildSearchParams({ page: newPage })
    router.push(`${pathname}${q ? `?${q}` : ''}`)
  }

  const handleRefresh = () => {
    router.refresh()
  }

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || mobileClients.length >= totalCount) return
    setLoadingMore(true)
    const result = await getClientsPage({
      search: initialSearch || undefined,
      status: initialStatus !== 'all' ? initialStatus : undefined,
      sortField: initialSortField ?? undefined,
      sortDirection: initialSortDirection,
      page: mobilePage + 1,
      pageSize,
    })
    setLoadingMore(false)
    if (result.data?.length) {
      setMobileClients((prev) => [...prev, ...result.data])
      setMobilePage((prev) => prev + 1)
    }
  }, [loadingMore, mobileClients.length, totalCount, initialSearch, initialStatus, initialSortField, initialSortDirection, mobilePage, pageSize])

  const handleOpenInternalNotes = (clientId: string, clientName: string) => {
    if (!canManageInternalNotes) {
      showError('Permission Denied', 'You do not have permission to view internal notes.')
      return
    }
    setInternalNotesClientId(clientId)
    setInternalNotesClientName(clientName)
    setInternalNotesOpen(true)
  }

  return (
    <>
      <div className="flex h-full flex-col p-4 lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#1E1B4B]">Clients</h1>
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
              title={canWrite ? 'Create client' : 'Read-only access'}
              className={`btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${!canWrite ? 'hover:shadow-lg hover:-translate-y-0' : ''}`}
            >
              Create Client
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col">
          <ClientsFilters
            statusFilter={initialStatus}
            onStatusChange={(s) => handleFilterChange({ status: s })}
            searchQuery={initialSearch}
            onSearchChange={(q) => handleFilterChange({ search: q })}
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
              <ClientsCardList
                clients={mobileClients}
                canWrite={canWrite}
                canManageInternalNotes={canManageInternalNotes}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onOpenInternalNotes={handleOpenInternalNotes}
                isFiltered={initialStatus !== 'all' || initialSearch.trim() !== ''}
                hasMore={mobileClients.length < totalCount}
                loadingMore={loadingMore}
                onLoadMore={handleLoadMore}
              />
            </div>
            {/* Desktop: table + pagination (md and up) */}
            <div className="hidden md:block h-full">
              <ClientsTable
                clients={clients}
                canWrite={canWrite}
                canManageInternalNotes={canManageInternalNotes}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onOpenInternalNotes={handleOpenInternalNotes}
                sortField={initialSortField}
                sortDirection={initialSortField ? initialSortDirection : undefined}
                onSort={handleSort}
                isFiltered={initialStatus !== 'all' || initialSearch.trim() !== ''}
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
      <ClientModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        mode="create"
        onSubmit={handleCreate}
      />

      {/* Edit Modal */}
      <ClientModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setSelectedClientId(null)
          setSelectedClient(null)
        }}
        mode="edit"
        initialData={getInitialEditData()}
        onSubmit={handleUpdate}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        clientName={deleteClientName}
        isLoading={deleting}
      />

      {canManageInternalNotes && (
        <InternalNotesPanel
          clientId={internalNotesClientId}
          clientName={internalNotesClientName}
          isOpen={internalNotesOpen}
          onClose={() => setInternalNotesOpen(false)}
        />
      )}
    </>
  )
}
