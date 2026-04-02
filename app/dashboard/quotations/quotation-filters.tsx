'use client'

import { QuotationStatus, QuotationSourceType } from '@/lib/quotations/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import { SearchInput } from '@/app/components/ui/search-input'

const SEARCH_DEBOUNCE_MS = 350

const STATUS_OPTIONS: { value: QuotationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'under_discussion', label: 'Under Discussion' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
]

const SOURCE_OPTIONS: { value: QuotationSourceType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'lead', label: 'Lead' },
  { value: 'client', label: 'Client' },
]

export type QuotationSortField =
  | 'quotation_number'
  | 'valid_till'
  | 'final_total'
  | 'status'
  | 'created_at'
  | null

interface QuotationFiltersProps {
  statusFilter: QuotationStatus | 'all'
  onStatusChange: (status: QuotationStatus | 'all') => void
  sourceFilter: QuotationSourceType | 'all'
  onSourceChange: (source: QuotationSourceType | 'all') => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onClearFilters: () => void
}

export function QuotationFilters({
  statusFilter,
  onStatusChange,
  sourceFilter,
  onSourceChange,
  searchQuery,
  onSearchChange,
  onClearFilters,
}: QuotationFiltersProps) {
  const hasActiveFilters =
    statusFilter !== 'all' ||
    sourceFilter !== 'all' ||
    searchQuery.trim() !== ''

  const isConvertedOnly = statusFilter === 'converted'

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex-1 sm:max-w-xs">
            <SearchInput
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search by number or reference..."
              debounceMs={SEARCH_DEBOUNCE_MS}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStatusChange(isConvertedOnly ? 'all' : 'converted')}
              aria-pressed={isConvertedOnly}
              title={isConvertedOnly ? 'Showing Converted (click to show all)' : 'Show only Converted'}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border text-sm transition-colors ${
                isConvertedOnly
                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {/* refresh-like icon to indicate "converted" state */}
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-3.3-6.9" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
            <div className="sm:w-40">
            <ListboxDropdown
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => onStatusChange(v as QuotationStatus | 'all')}
              ariaLabel="Filter by status"
            />
            </div>
          </div>
          <div className="sm:w-36">
            <ListboxDropdown
              value={sourceFilter}
              options={SOURCE_OPTIONS}
              onChange={(v) => onSourceChange(v as QuotationSourceType | 'all')}
              ariaLabel="Filter by source"
            />
          </div>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 whitespace-nowrap"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  )
}
