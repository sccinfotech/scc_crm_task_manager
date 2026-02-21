'use client'

import { useState, useEffect } from 'react'
import { ClientStatus } from '@/lib/clients/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'

const SEARCH_DEBOUNCE_MS = 300

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
  const [localSearch, setLocalSearch] = useState(searchQuery)
  useEffect(() => {
    setLocalSearch(searchQuery)
  }, [searchQuery])
  useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchChange(localSearch)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [localSearch, onSearchChange, searchQuery])

  const hasActiveFilters =
    statusFilter !== 'all' || searchQuery.trim() !== ''

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search and Filters */}
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="flex-1 sm:max-w-xs">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search by name or company..."
                className="block w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20"
              />
            </div>
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
