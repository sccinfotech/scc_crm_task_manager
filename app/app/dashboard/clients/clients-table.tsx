import { EmptyState } from '@/app/components/empty-state'
import { Tooltip } from '@/app/components/ui/tooltip'

type Client = {
  id: string
  name: string
  company_name: string | null
  phone: string
  email: string | null
  status: 'active' | 'inactive'
  created_at: string
  created_by?: string
}

type SortField = 'name' | 'company_name' | 'phone' | 'status' | 'created_at' | null
type SortDirection = 'asc' | 'desc' | null

interface ClientsTableProps {
  clients: Client[]
  canWrite: boolean
  canManageInternalNotes?: boolean
  onView: (clientId: string) => void
  onEdit: (clientId: string) => void
  onDelete: (clientId: string, clientName: string) => void
  onOpenInternalNotes?: (clientId: string, clientName: string) => void
  sortField?: SortField
  sortDirection?: SortDirection
  onSort?: (field: SortField) => void
  isFiltered?: boolean
}

function StatusPill({ status }: { status: Client['status'] }) {
  const styles = {
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-600', ring: 'ring-emerald-600/20' },
    inactive: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-600', ring: 'ring-gray-600/20' },
  }

  const labels = {
    active: 'Active',
    inactive: 'Inactive',
  }

  const style = styles[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${style.bg} ${style.text} ring-1 ring-inset ${style.ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`}></span>
      {labels[status]}
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

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (!direction) {
    return (
      <svg className="ml-1 h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    )
  }
  return direction === 'asc' ? (
    <svg className="ml-1 h-3.5 w-3.5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="ml-1 h-3.5 w-3.5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export function ClientsTable({
  clients,
  canWrite,
  canManageInternalNotes = false,
  onView,
  onEdit,
  onDelete,
  onOpenInternalNotes,
  sortField = null,
  sortDirection = null,
  onSort,
  isFiltered = false,
}: ClientsTableProps) {
  const handleSort = (field: SortField) => {
    if (!onSort) return
    if (sortField === field) {
      onSort(sortDirection === 'asc' ? null : field)
    } else {
      onSort(field)
    }
  }

  const handleRowClick = (clientId: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button')) {
      return
    }
    onView(clientId)
  }

  if (clients.length === 0) {
    return (
      <div className="flex h-full w-full min-h-[500px] items-center justify-center bg-white">
        <div className="w-full max-w-lg">
          <EmptyState
            variant={isFiltered ? 'search' : 'leads'}
            title={isFiltered ? 'No clients found' : 'No clients yet'}
            description={
              isFiltered
                ? 'Try adjusting your filters.'
                : 'Create your first client to get started.'
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-white">
      <table className="w-full table-fixed divide-y divide-gray-100">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="bg-gray-50/50">
            <th
              className="group w-[40%] sm:w-[20%] px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center">
                Client Name
                <SortIcon direction={sortField === 'name' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="group hidden sm:table-cell sm:w-[15%] px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-all duration-200"
              onClick={() => handleSort('company_name')}
            >
              <div className="flex items-center">
                Company
                <SortIcon direction={sortField === 'company_name' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="group w-[30%] sm:w-[15%] px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => handleSort('phone')}
            >
              <div className="flex items-center">
                Phone
                <SortIcon direction={sortField === 'phone' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="group hidden md:table-cell md:w-[15%] px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-colors"
            >
              Email
            </th>
            <th
              className="group w-[15%] sm:w-[12%] px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center">
                Status
                <SortIcon direction={sortField === 'status' ? sortDirection : null} />
              </div>
            </th>
            <th
              className="group hidden lg:table-cell lg:w-[13%] px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:bg-gray-50 transition-all duration-200"
              onClick={() => handleSort('created_at')}
            >
              <div className="flex items-center">
                Created
                <SortIcon direction={sortField === 'created_at' ? sortDirection : null} />
              </div>
            </th>
            <th className="w-[15%] sm:w-[12%] px-4 sm:px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 transition-all duration-200">
              {canWrite || canManageInternalNotes ? 'Actions' : 'View'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {clients.map((client) => {
            const canEdit = canWrite
            const canDelete = canWrite

            return (
              <tr
                key={client.id}
                className="group transition-all duration-200 hover:bg-slate-50 cursor-pointer"
                onClick={(e) => handleRowClick(client.id, e)}
              >
                <td className="px-4 sm:px-6 py-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs sm:text-sm font-bold text-white shadow-sm flex-shrink-0 ring-2 ring-white">
                      {client.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm sm:text-base font-semibold text-gray-900 leading-tight" title={client.name}>
                        {client.name}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="hidden px-6 py-3 sm:table-cell">
                  <div className="truncate text-sm text-gray-500" title={client.company_name || '—'}>
                    {client.company_name || '—'}
                  </div>
                </td>
                <td className="px-4 sm:px-6 py-3">
                  <div className="truncate text-sm text-gray-500 font-medium" title={client.phone}>
                    {client.phone}
                  </div>
                </td>
                <td className="hidden px-6 py-3 md:table-cell">
                  <div className="truncate text-sm text-gray-500" title={client.email || '—'}>
                    {client.email || '—'}
                  </div>
                </td>
                <td className="px-4 sm:px-6 py-3">
                  <StatusPill status={client.status} />
                </td>
                <td className="hidden px-6 py-3 text-sm text-gray-500 lg:table-cell">
                  {formatDate(client.created_at)}
                </td>
                <td className="px-4 sm:px-6 py-3 text-right text-sm" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    {canManageInternalNotes && onOpenInternalNotes && (
                      <Tooltip content="Internal notes" position="left">
                        <button
                          onClick={() => onOpenInternalNotes(client.id, client.name)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                        >
                          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 4h8m-8 4h6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H9l-4 4V7a2 2 0 012-2z" />
                          </svg>
                        </button>
                      </Tooltip>
                    )}
                    {canEdit && (
                      <Tooltip content="Edit client details" position="left">
                        <button
                          onClick={() => onEdit(client.id)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip content="Remove client record" position="left">
                        <button
                          onClick={() => onDelete(client.id, client.name)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </Tooltip>
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
