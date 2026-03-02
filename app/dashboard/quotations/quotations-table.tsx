'use client'

import Link from 'next/link'
import { EmptyState } from '@/app/components/empty-state'
import type { QuotationListItem, QuotationStatus } from '@/lib/quotations/actions'
import type { QuotationSortField } from './quotation-filters'

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-600/20',
  sent: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  under_discussion: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  expired: 'bg-gray-50 text-gray-600 ring-gray-600/20',
  converted: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
}

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  under_discussion: 'Under Discussion',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
}

function StatusPill({ status }: { status: QuotationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

interface QuotationsTableProps {
  quotations: QuotationListItem[]
  canWrite: boolean
  onView: (id: string) => void
  sortField: QuotationSortField
  sortDirection: 'asc' | 'desc' | null
  onSort?: (field: QuotationSortField) => void
  isFiltered?: boolean
}

export function QuotationsTable({
  quotations,
  canWrite,
  onView,
  sortField,
  sortDirection,
  onSort,
  isFiltered = false,
}: QuotationsTableProps) {
  if (quotations.length === 0) {
    return (
      <div className="flex h-full w-full min-h-[500px] items-center justify-center bg-white">
        <div className="w-full max-w-lg">
          <EmptyState
            variant={isFiltered ? 'search' : 'leads'}
            title={isFiltered ? 'No quotations found' : 'No quotations yet'}
            description={
              isFiltered
                ? 'Try adjusting your filters.'
                : 'Create a quotation from a Lead or Client to get started.'
            }
          />
        </div>
      </div>
    )
  }

  const SortHeader = ({
    field,
    label,
  }: {
    field: QuotationSortField
    label: string
  }) => (
    <button
      type="button"
      onClick={() => onSort?.(sortField === field ? (sortDirection === 'asc' ? field : null) : field)}
      className="group flex items-center font-semibold text-slate-700"
    >
      {label}
      {sortField === field && sortDirection && (
        <span className="ml-1 text-[#06B6D4]">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  )

  return (
    <div className="overflow-x-auto bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <SortHeader field="quotation_number" label="Quotation #" />
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Source
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Lead / Client
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Technology & Tools
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <SortHeader field="final_total" label="Final Total" />
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <SortHeader field="status" label="Status" />
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <SortHeader field="valid_till" label="Valid Till" />
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <SortHeader field="created_at" label="Created" />
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {quotations.map((q) => (
            <tr
              key={q.id}
              className="hover:bg-gray-50 transition-colors"
            >
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[#06B6D4]">
                <Link
                  href={`/dashboard/quotations/${q.id}`}
                  className="hover:underline"
                >
                  {q.quotation_number}
                </Link>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 capitalize">
                {q.source_type}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900 max-w-[180px] truncate" title={q.source_name}>
                {q.source_name}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 max-w-[160px] truncate" title={q.technology_tools_display}>
                {q.technology_tools_display}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                {formatCurrency(q.final_total)}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <StatusPill status={q.status} />
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                {q.valid_till ? formatDate(q.valid_till) : '—'}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                {formatDate(q.created_at)}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                <Link
                  href={`/dashboard/quotations/${q.id}`}
                  className="text-[#06B6D4] font-medium hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
