'use client'

import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import { SearchInput } from '@/app/components/ui/search-input'
import type { InvoicePaymentStatus } from '@/lib/invoices/actions'

const SEARCH_DEBOUNCE_MS = 350

interface InvoicesFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  clientFilter: string
  clientOptions: Array<{ value: string; label: string }>
  onClientChange: (value: string) => void
  statusFilter: InvoicePaymentStatus | 'all'
  statusOptions: Array<{ value: InvoicePaymentStatus | 'all'; label: string }>
  onStatusChange: (value: string) => void
  onClearFilters: () => void
}

export function InvoicesFilters({
  searchQuery,
  onSearchChange,
  clientFilter,
  clientOptions,
  onClientChange,
  statusFilter,
  statusOptions,
  onStatusChange,
  onClearFilters,
}: InvoicesFiltersProps) {
  const hasActiveFilters =
    searchQuery.trim() !== '' || !!clientFilter || statusFilter !== 'all'

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex-1 sm:max-w-xs">
            <SearchInput
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search invoice number..."
              debounceMs={SEARCH_DEBOUNCE_MS}
            />
          </div>
          <div className="sm:w-56">
            <ListboxDropdown
              value={clientFilter}
              options={clientOptions}
              onChange={onClientChange}
              ariaLabel="Filter by client"
              searchable
              placeholder="All clients"
              searchPlaceholder="Search clients…"
            />
          </div>
          <div className="sm:w-44">
            <ListboxDropdown
              value={statusFilter}
              options={statusOptions}
              onChange={onStatusChange}
              ariaLabel="Filter by payment status"
            />
          </div>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 whitespace-nowrap"
          >
            Clear Filters
          </button>
        ) : null}
      </div>
    </div>
  )
}
