'use client'

import { useState, useEffect } from 'react'
import { ClientStatus } from '@/lib/clients/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import { SearchInput } from '@/app/components/ui/search-input'

const SEARCH_DEBOUNCE_MS = 350

interface ClientsFiltersProps {
  statusFilter: ClientStatus | 'all'
  onStatusChange: (status: ClientStatus | 'all') => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onClearFilters: () => void
}

const STATUS_OPTIONS: { value: ClientStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export function ClientsFilters({
  statusFilter,
  onStatusChange,
  searchQuery,
  onSearchChange,
  onClearFilters,
}: ClientsFiltersProps) {
  // Debounced search logic removed as handled by SearchInput component

  const hasActiveFilters =
    statusFilter !== 'all' || searchQuery.trim() !== ''

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search and Filters */}
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="flex-1 sm:max-w-xs">
            <SearchInput
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search by name or company..."
              debounceMs={SEARCH_DEBOUNCE_MS}
            />
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <ListboxDropdown
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => onStatusChange(v as ClientStatus | 'all')}
              ariaLabel="Filter by status"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
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
