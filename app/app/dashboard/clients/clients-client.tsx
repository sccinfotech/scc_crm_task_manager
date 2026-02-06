'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ClientsTable } from './clients-table'
import { ClientModal } from './client-modal'
import { DeleteConfirmModal } from './delete-confirm-modal'
import { ClientsFilters } from './clients-filters'
import { InternalNotesPanel } from './internal-notes-panel'
import { createClient, updateClient, getClient, deleteClient, ClientFormData, Client, ClientStatus } from '@/lib/clients/actions'
import { useToast } from '@/app/components/ui/toast-context'

type ClientListItem = {
  id: string
  name: string
  company_name: string | null
  phone: string
  email: string | null
  status: 'active' | 'inactive'
  created_at: string
  created_by?: string
}

interface ClientsClientProps {
  clients: ClientListItem[]
  canWrite: boolean
  canManageInternalNotes: boolean
}

export function ClientsClient({ clients, canWrite, canManageInternalNotes }: ClientsClientProps) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [deleteClientName, setDeleteClientName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortField, setSortField] = useState<'name' | 'company_name' | 'phone' | 'status' | 'created_at' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [internalNotesOpen, setInternalNotesOpen] = useState(false)
  const [internalNotesClientId, setInternalNotesClientId] = useState<string | null>(null)
  const [internalNotesClientName, setInternalNotesClientName] = useState<string>('')

  // Filter and sort clients
  const filteredAndSortedClients = useMemo(() => {
    let result = clients.filter((client) => {
      // Status filter
      if (statusFilter !== 'all' && client.status !== statusFilter) {
        return false
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesName = client.name.toLowerCase().includes(query)
        const matchesCompany = client.company_name?.toLowerCase().includes(query) || false
        if (!matchesName && !matchesCompany) {
          return false
        }
      }

      return true
    })

    // Apply sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        let aValue: any
        let bValue: any

        switch (sortField) {
          case 'name':
            aValue = a.name.toLowerCase()
            bValue = b.name.toLowerCase()
            break
          case 'company_name':
            aValue = (a.company_name || '').toLowerCase()
            bValue = (b.company_name || '').toLowerCase()
            break
          case 'phone':
            aValue = a.phone
            bValue = b.phone
            break
          case 'status':
            aValue = a.status
            bValue = b.status
            break
          case 'created_at':
            aValue = new Date(a.created_at).getTime()
            bValue = new Date(b.created_at).getTime()
            break
          default:
            return 0
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [clients, statusFilter, searchQuery, sortField, sortDirection])

  const handleSort = (field: 'name' | 'company_name' | 'phone' | 'status' | 'created_at' | null) => {
    if (!field) {
      setSortField(null)
      setSortDirection('asc')
      return
    }

    if (sortField === field) {
      // Toggle direction: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortField(null)
        setSortDirection('asc')
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
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

  const handleClearFilters = () => {
    setStatusFilter('all')
    setSearchQuery('')
  }

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
        {/* Page Title and Create Client Button */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#1E1B4B]">Clients</h1>
          <button
            onClick={() => setCreateModalOpen(true)}
            disabled={!canWrite}
            title={canWrite ? 'Create client' : 'Read-only access'}
            className={`btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${!canWrite ? 'hover:shadow-lg hover:-translate-y-0' : ''}`}
          >
            Create Client
          </button>
        </div>

        {/* Full Height Table Container */}
        <div className="flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col">
          {/* Filters */}
          <ClientsFilters
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClearFilters={handleClearFilters}
          />

          {loading && (
            <div className="border-b border-gray-200 bg-blue-50 px-6 py-3">
              <p className="text-sm text-blue-800">Loading...</p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <ClientsTable
              clients={filteredAndSortedClients}
              canWrite={canWrite}
              canManageInternalNotes={canManageInternalNotes}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onOpenInternalNotes={handleOpenInternalNotes}
              sortField={sortField}
              sortDirection={sortField ? sortDirection : undefined}
              onSort={handleSort}
              isFiltered={statusFilter !== 'all' || searchQuery.trim() !== ''}
            />
          </div>
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
