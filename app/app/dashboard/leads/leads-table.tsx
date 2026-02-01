import { EmptyState } from '@/app/components/empty-state'

type Lead = {
  id: string
  name: string
  company_name: string | null
  phone: string
  status: 'new' | 'contacted' | 'follow_up' | 'converted' | 'lost'
  created_at: string
  follow_up_date: string | null
  created_by?: string
}

type SortField = 'name' | 'company_name' | 'phone' | 'status' | 'follow_up_date' | 'created_at' | null
type SortDirection = 'asc' | 'desc'

interface LeadsTableProps {
  leads: Lead[]
  currentUserId?: string
  userRole?: string
  onView: (leadId: string) => void
  onEdit: (leadId: string) => void
  onDelete: (leadId: string, leadName: string) => void
  sortField?: SortField
  sortDirection?: SortDirection
  onSort?: (field: SortField) => void
  isFiltered?: boolean
}

function StatusPill({ status }: { status: Lead['status'] }) {
  const statusStyles = {
    new: 'bg-cyan-100 text-cyan-700',
    contacted: 'bg-purple-100 text-purple-700',
    follow_up: 'bg-purple-200 text-purple-800',
    converted: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
  }

  const statusLabels = {
    new: 'New',
    contacted: 'Contacted',
    follow_up: 'Follow Up',
    converted: 'Converted',
    lost: 'Lost',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  )
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatFollowUpDate(dateString: string | null) {
  if (!dateString) return null
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getFollowUpDateColor(dateString: string | null): string {
  if (!dateString) return 'text-gray-600'
  
  const followUpDate = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const followUpDateOnly = new Date(followUpDate)
  followUpDateOnly.setHours(0, 0, 0, 0)
  
  const diffTime = followUpDateOnly.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  // Red: today or past dates
  if (diffDays <= 0) {
    return 'text-red-600 font-bold'
  }
  
  // Orange: upcoming dates (within next 7 days)
  if (diffDays <= 7) {
    return 'text-orange-600 font-bold'
  }
  
  // Black: other future dates
  return 'text-[#1E1B4B] font-bold'
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (!direction) {
    return (
      <svg className="ml-1 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    )
  }
  return direction === 'asc' ? (
    <svg className="ml-1 h-4 w-4 text-[#06B6D4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="ml-1 h-4 w-4 text-[#06B6D4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export function LeadsTable({
  leads,
  currentUserId,
  userRole,
  onView,
  onEdit,
  onDelete,
  sortField = null,
  sortDirection = null,
  onSort,
  isFiltered = false,
}: LeadsTableProps) {
  const handleSort = (field: SortField) => {
    if (!onSort) return
    if (sortField === field) {
      // Toggle direction if same field
      onSort(sortDirection === 'asc' ? null : field)
    } else {
      onSort(field)
    }
  }

  const handleRowClick = (leadId: string, e: React.MouseEvent) => {
    // Don't trigger if clicking on action buttons
    const target = e.target as HTMLElement
    if (target.closest('button')) {
      return
    }
    onView(leadId)
  }
  if (leads.length === 0) {
    return (
      <div className="flex h-full w-full min-h-[500px] items-center justify-center">
        <div className="w-full max-w-lg">
          <EmptyState
            variant={isFiltered ? 'search' : 'leads'}
            title={isFiltered ? 'No leads match your filters' : 'No leads found'}
            description={
              isFiltered
                ? 'Try adjusting your search or filter criteria to find what you\'re looking for.'
                : 'Get started by creating your first lead. Track potential customers and manage your sales pipeline effectively.'
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <table className="w-full table-fixed">
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr className="border-b border-gray-200">
            <th
              className="w-[18%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] sm:w-[15%] cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center">
                Lead Name
                <SortIcon direction={sortField === 'name' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="hidden w-[15%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] sm:table-cell cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('company_name')}
            >
              <div className="flex items-center">
                Company
                <SortIcon direction={sortField === 'company_name' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="w-[15%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] sm:w-[12%] cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('phone')}
            >
              <div className="flex items-center">
                Phone
                <SortIcon direction={sortField === 'phone' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] sm:w-[10%] cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center">
                Status
                <SortIcon direction={sortField === 'status' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="hidden w-[15%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] md:table-cell cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('follow_up_date')}
            >
              <div className="flex items-center">
                Follow-up Date
                <SortIcon direction={sortField === 'follow_up_date' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="hidden w-[12%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] lg:table-cell cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('created_at')}
            >
              <div className="flex items-center">
                Created
                <SortIcon direction={sortField === 'created_at' ? sortDirection : null} />
              </div>
            </th>
            <th className="w-[15%] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] sm:w-[12%]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {leads.map((lead) => {
            const canEdit =
              userRole === 'admin' || lead.created_by === currentUserId
            const canDelete = canEdit // Same permissions as edit

            return (
              <tr
                key={lead.id}
                className="transition-colors hover:bg-gray-50 cursor-pointer"
                onClick={(e) => handleRowClick(lead.id, e)}
              >
                <td className="px-4 py-4 text-sm">
                  <div className="truncate font-bold text-[#1E1B4B]" title={lead.name}>
                    {lead.name}
                  </div>
                </td>
                <td className="hidden px-4 py-4 text-sm text-gray-600 sm:table-cell">
                  <div className="truncate" title={lead.company_name || '—'}>
                    {lead.company_name || '—'}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  <div className="truncate" title={lead.phone}>
                    {lead.phone}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm">
                  <StatusPill status={lead.status} />
                </td>
                <td className="hidden px-4 py-4 text-sm md:table-cell">
                  {lead.follow_up_date ? (
                    <span className={getFollowUpDateColor(lead.follow_up_date)}>
                      {formatFollowUpDate(lead.follow_up_date)}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="hidden px-4 py-4 text-sm text-gray-600 lg:table-cell">
                  {formatDate(lead.created_at)}
                </td>
                <td className="px-4 py-4 text-right text-sm" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    {canEdit && (
                      <button
                        onClick={() => onEdit(lead.id)}
                        className="rounded-lg p-2 text-[#7C3AED] transition-colors hover:bg-purple-50"
                        aria-label="Edit lead"
                        title="Edit"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => onDelete(lead.id, lead.name)}
                        className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                        aria-label="Delete lead"
                        title="Delete"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


