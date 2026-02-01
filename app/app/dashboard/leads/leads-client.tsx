'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LeadsTable } from './leads-table'
import { LeadModal } from './lead-modal'
import { LeadDetails } from './lead-details'
import { DeleteConfirmModal } from './delete-confirm-modal'
import { LeadsFilters } from './leads-filters'
import { createLead, updateLead, getLead, deleteLead, LeadFormData, Lead, LeadStatus } from '@/lib/leads/actions'

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
  currentUserId: string
  userRole: string
}

export function LeadsClient({ leads, currentUserId, userRole }: LeadsClientProps) {
  const router = useRouter()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
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
    setLoading(true)
    const result = await createLead(formData)
    setLoading(false)
    if (!result.error) {
      router.refresh()
    }
    return result
  }

  const handleUpdate = async (formData: LeadFormData) => {
    if (!selectedLeadId) return { error: 'No lead selected' }
    setLoading(true)
    const result = await updateLead(selectedLeadId, formData)
    setLoading(false)
    if (!result.error) {
      router.refresh()
      // If details view is open, refresh the lead data
      if (detailsModalOpen && selectedLeadId) {
        const updatedResult = await getLead(selectedLeadId)
        if (updatedResult.data) {
          setSelectedLead(updatedResult.data)
        }
      }
    }
    return result
  }

  const handleView = (leadId: string) => {
    // Navigate to the lead detail page route
    router.push(`/dashboard/leads/${leadId}`)
  }

  const handleEdit = async (leadId: string) => {
    setLoading(true)
    const result = await getLead(leadId)
    setLoading(false)
    if (result.data) {
      setSelectedLead(result.data)
      setSelectedLeadId(leadId)
      setEditModalOpen(true)
    } else {
      alert(result.error || 'Failed to load lead for editing')
    }
  }

  const handleEditFromDetails = () => {
    // Don't close details view, just open edit modal on top
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
    setSelectedLeadId(leadId)
    setDeleteLeadName(leadName)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedLeadId) return

    setDeleting(true)
    const result = await deleteLead(selectedLeadId)
    setDeleting(false)

    if (!result.error) {
      setDeleteModalOpen(false)
      setSelectedLeadId(null)
      setDeleteLeadName('')
      router.refresh()
    } else {
      alert(result.error || 'Failed to delete lead')
    }
  }

  const handleCloseDelete = () => {
    setDeleteModalOpen(false)
    setSelectedLeadId(null)
    setDeleteLeadName('')
  }

  const canEditLead = (lead: LeadListItem) => {
    return userRole === 'admin' || lead.created_by === currentUserId
  }

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

  return (
    <>
      {/* Full Height Container */}
      <div className="flex h-full flex-col">
        {/* Page Title and Create Lead Button */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#1E1B4B]">Leads</h1>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
          <div className="flex-1 overflow-auto">
            <LeadsTable
              leads={filteredAndSortedLeads}
              currentUserId={currentUserId}
              userRole={userRole}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              sortField={sortField}
              sortDirection={sortField ? sortDirection : null}
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
          canEdit={canEditLead(selectedLead as LeadListItem)}
          canDelete={canEditLead(selectedLead as LeadListItem)}
          currentUserId={currentUserId}
          userRole={userRole}
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
    </>
  )
}

