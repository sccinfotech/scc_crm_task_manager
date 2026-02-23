'use client'

import { useState, useEffect, useRef } from 'react'
import { LeadStatus } from '@/lib/leads/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import { SearchInput } from '@/app/components/ui/search-input'

type FollowUpDateFilter = 'all' | 'today' | 'this_week' | 'this_month' | 'overdue' | 'no_followup'

const SEARCH_DEBOUNCE_MS = 350

interface LeadsFiltersProps {
  statusFilter: LeadStatus | 'all'
  onStatusChange: (status: LeadStatus | 'all') => void
  searchQuery: string
  onSearchChange: (query: string) => void
  followUpDateFilter: FollowUpDateFilter
  onFollowUpDateChange: (filter: FollowUpDateFilter) => void
  onClearFilters: () => void
}

const STATUS_OPTIONS: { value: LeadStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
]

const FOLLOW_UP_DATE_OPTIONS: { value: FollowUpDateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'no_followup', label: 'No Follow-up' },
]

export function LeadsFilters({
  statusFilter,
  onStatusChange,
  searchQuery,
  onSearchChange,
  followUpDateFilter,
  onFollowUpDateChange,
  onClearFilters,
}: LeadsFiltersProps) {
  // Debounced search logic removed from here as it's now handled by SearchInput component

  const hasActiveFilters =
    statusFilter !== 'all' || searchQuery.trim() !== '' || followUpDateFilter !== 'all'

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
              minLength={3}
            />
          </div>

          {/* Status + Follow-up: side by side horizontally on mobile and desktop */}
          <div className="flex flex-row gap-2 sm:gap-4 sm:items-center">
            <div className="flex-1 min-w-0 sm:flex-none sm:w-48">
              <ListboxDropdown
                value={statusFilter}
                options={STATUS_OPTIONS}
                onChange={(v) => onStatusChange(v as LeadStatus | 'all')}
                ariaLabel="Filter by status"
              />
            </div>
            <div className="flex-1 min-w-0 sm:flex-none sm:w-48">
              <ListboxDropdown
                value={followUpDateFilter}
                options={FOLLOW_UP_DATE_OPTIONS}
                onChange={(v) => onFollowUpDateChange(v as FollowUpDateFilter)}
                ariaLabel="Filter by follow-up date"
              />
            </div>
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

