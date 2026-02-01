'use client'

import { LeadStatus } from '@/lib/leads/actions'

type FollowUpDateFilter = 'all' | 'today' | 'this_week' | 'this_month' | 'overdue' | 'no_followup'

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
  const hasActiveFilters =
    statusFilter !== 'all' || searchQuery.trim() !== '' || followUpDateFilter !== 'all'

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
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by name or company..."
                className="block w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as LeadStatus | 'all')}
              className="block w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-[#1E1B4B] shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Follow-up Date Filter */}
          <div className="sm:w-48">
            <select
              value={followUpDateFilter}
              onChange={(e) => onFollowUpDateChange(e.target.value as FollowUpDateFilter)}
              className="block w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-[#1E1B4B] shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20"
            >
              {FOLLOW_UP_DATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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

