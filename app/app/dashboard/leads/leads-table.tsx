type Lead = {
  id: string
  name: string
  company_name: string | null
  phone: string
  email: string | null
  status: 'new' | 'contacted' | 'follow_up' | 'converted' | 'lost'
  created_at: string
}

interface LeadsTableProps {
  leads: Lead[]
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

export function LeadsTable({ leads }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-gray-500">No leads found</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
              Lead Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
              Company
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
              Phone
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="transition-colors hover:bg-gray-50"
            >
              <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900">
                {lead.name}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                {lead.company_name || '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                {lead.phone}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                {lead.email || '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm">
                <StatusPill status={lead.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                {formatDate(lead.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

