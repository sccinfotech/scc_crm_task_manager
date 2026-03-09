'use client'
import { useState } from 'react'
import { EmptyState } from '@/app/components/empty-state'
import { useToast } from '@/app/components/ui/toast-context'
import { Tooltip } from '@/app/components/ui/tooltip'
import type { QuotationListItem, QuotationStatus } from '@/lib/quotations/actions'
import { downloadQuotationPdf } from '@/lib/quotations/pdf-download'
import type { QuotationSortField } from './quotation-filters'

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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
  canDelete: boolean
  onView: (id: string) => void
  onChangeStatus: (id: string, quotationNumber: string, currentStatus: QuotationStatus) => void
  onEdit: (id: string) => void
  onDelete: (id: string, quotationNumber: string) => void
  onConvert?: (id: string) => void
  sortField: QuotationSortField
  sortDirection: 'asc' | 'desc' | null
  onSort?: (field: QuotationSortField) => void
  isFiltered?: boolean
}

export function QuotationsTable({
  quotations,
  canWrite,
  canDelete,
  onView,
  onChangeStatus,
  onEdit,
  onDelete,
  onConvert,
  sortField,
  sortDirection,
  onSort,
  isFiltered = false,
}: QuotationsTableProps) {
  const { error: showError } = useToast()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

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

  const handleDownloadPdf = async (quotationId: string, quotationNumber: string) => {
    if (downloadingId) return
    setDownloadingId(quotationId)
    try {
      await downloadQuotationPdf(quotationId, `${quotationNumber}.pdf`)
    } catch {
      showError('Download Failed', 'Unable to download quotation PDF right now.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="overflow-x-auto bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <SortHeader field="quotation_number" label="Quotation #" />
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Lead / Client
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
          {quotations.map((q) => {
            const isDownloading = downloadingId === q.id
            return (
            <tr
              key={q.id}
              onClick={() => onView(q.id)}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[#06B6D4]">
                <span className="hover:underline">{q.quotation_number}</span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-900 max-w-[180px] truncate" title={q.source_name}>
                {q.source_name}
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
                <div className="flex items-center justify-end gap-1">
                  <Tooltip content="Download quotation PDF">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDownloadPdf(q.id, q.quotation_number)
                      }}
                      disabled={isDownloading}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Download quotation PDF"
                    >
                      {isDownloading ? (
                        <svg className="h-4.5 w-4.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
                        </svg>
                      ) : (
                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v11m0 0l4-4m-4 4l-4-4M5 17v1a2 2 0 002 2h10a2 2 0 002-2v-1" />
                        </svg>
                      )}
                    </button>
                  </Tooltip>
                  {canWrite && q.status !== 'converted' && (
                    <Tooltip content="Change quotation status">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onChangeStatus(q.id, q.quotation_number, q.status)
                        }}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                        aria-label="Change quotation status"
                      >
                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10m-10 6h6" />
                        </svg>
                      </button>
                    </Tooltip>
                  )}
                  {canWrite && q.status === 'approved' && onConvert && (
                    <Tooltip content="Convert to project">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onConvert(q.id)
                        }}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-teal-50 hover:text-teal-600"
                        aria-label="Convert quotation to project"
                      >
                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5h6a2 2 0 012 2v2M9 19h6a2 2 0 002-2v-2M9 19a2 2 0 01-2-2v-2m0-4V7a2 2 0 012-2m0 0L7 3m2 2l2 2"
                          />
                        </svg>
                      </button>
                    </Tooltip>
                  )}
                  {canWrite && q.status !== 'converted' && (
                    <Tooltip content="Edit quotation">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(q.id)
                        }}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        aria-label="Edit quotation"
                      >
                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </Tooltip>
                  )}
                  {canDelete && q.status !== 'converted' && (
                    <Tooltip content="Delete quotation">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(q.id, q.quotation_number)
                        }}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete quotation"
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
