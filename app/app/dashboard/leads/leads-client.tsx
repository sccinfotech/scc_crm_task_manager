'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LeadsTable } from './leads-table'
import { LeadModal } from './lead-modal'
import { LeadDetails } from './lead-details'
import { DeleteConfirmModal } from './delete-confirm-modal'
import { LeadsFilters } from './leads-filters'
import { createLead, updateLead, getLead, deleteLead, LeadFormData, Lead, LeadStatus } from '@/lib/leads/actions'
import { createClient, ClientFormData } from '@/lib/clients/actions'
import { useToast } from '@/app/components/ui/toast-context'
import { ClientModal } from '../clients/client-modal'

type LeadListItem = {
  id: string
  name: string
  company_name: string | null
  phone: string
  status: 'new' | 'contacted' | 'follow_up' | 'converted' | 'lost'
  created_at: string
  follow_up_date: string | null
  created_by?: string
}

interface LeadsClientProps {
  leads: LeadListItem[]
  canWrite: boolean
  canCreateClient?: boolean
}

export function LeadsClient({ leads, canWrite, canCreateClient = false }: LeadsClientProps) {
  const router = useRouter()
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
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [followUpDateFilter, setFollowUpDateFilter] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'overdue' | 'no_followup'>('all')
  const [sortField, setSortField] = useState<'name' | 'company_name' | 'phone' | 'status' | 'follow_up_date' | 'created_at' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Helper function to check if a lead's follow-up date matches the filter
  const matchesFollowUpDateFilter = (followUpDate: string | null): boolean => {
    if (followUpDateFilter === 'all') return true
    if (followUpDateFilter === 'no_followup') return !followUpDate

    if (!followUpDate) return false

    const followUp = new Date(followUpDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const followUpDateOnly = new Date(followUp)
    followUpDateOnly.setHours(0, 0, 0, 0)

    const diffTime = followUpDateOnly.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    switch (followUpDateFilter) {
      case 'today':
        return diffDays === 0
      case 'this_week':
        return diffDays >= 0 && diffDays <= 7
      case 'this_month':
        return diffDays >= 0 && diffDays <= 30
      case 'overdue':
        return diffDays < 0
      default:
        return true
    }
  }

  // Filter and sort leads
  const filteredAndSortedLeads = useMemo(() => {
    let result = leads.filter((lead) => {
      // Status filter
      if (statusFilter !== 'all' && lead.status !== statusFilter) {
        return false
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesName = lead.name.toLowerCase().includes(query)
        const matchesCompany = lead.company_name?.toLowerCase().includes(query) || false
        if (!matchesName && !matchesCompany) {
          return false
        }
      }

      // Follow-up date filter
      if (!matchesFollowUpDateFilter(lead.follow_up_date)) {
        return false
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
          case 'follow_up_date':
            aValue = a.follow_up_date ? new Date(a.follow_up_date).getTime() : 0
            bValue = b.follow_up_date ? new Date(b.follow_up_date).getTime() : 0
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
  }, [leads, statusFilter, searchQuery, followUpDateFilter, sortField, sortDirection])

  const handleSort = (field: 'name' | 'company_name' | 'phone' | 'status' | 'follow_up_date' | 'created_at' | null) => {
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

  const handleClearFilters = () => {
    setStatusFilter('all')
    setSearchQuery('')
    setFollowUpDateFilter('all')
  }

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
        {/* Page Title and Create Lead Button */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#1E1B4B]">Leads</h1>
          <button
            onClick={() => setCreateModalOpen(true)}
            disabled={!canWrite}
            title={canWrite ? 'Create lead' : 'Read-only access'}
            className={`btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${!canWrite ? 'hover:shadow-lg hover:-translate-y-0' : ''}`}
          >
            Create Lead
          </button>
        </div>

        {/* Full Height Table Container */}
        <div className="flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col">
          {/* Filters */}
          <LeadsFilters
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            followUpDateFilter={followUpDateFilter}
            onFollowUpDateChange={setFollowUpDateFilter}
            onClearFilters={handleClearFilters}
          />

          {loading && (
            <div className="border-b border-gray-200 bg-blue-50 px-6 py-3">
              <p className="text-sm text-blue-800">Loading...</p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <LeadsTable
              leads={filteredAndSortedLeads}
              canWrite={canWrite}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onConvert={handleConvert}
              canConvert={canConvert}
              sortField={sortField}
              sortDirection={sortField ? sortDirection : undefined}
              onSort={handleSort}
              isFiltered={statusFilter !== 'all' || searchQuery.trim() !== '' || followUpDateFilter !== 'all'}
            />
          </div>
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
