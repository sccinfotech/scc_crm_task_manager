'use client'

import { useState, useEffect } from 'react'
import { ProjectStatus } from '@/lib/projects/actions'
import type { StaffSelectOption } from '@/lib/users/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'

const SEARCH_DEBOUNCE_MS = 300

interface ProjectsFiltersProps {
  title?: string
  /** Tighter padding and gaps when used in embedded contexts (e.g. User Detail tab) */
  compact?: boolean
  statusFilter: ProjectStatus | 'all'
  onStatusChange: (status: ProjectStatus | 'all') => void
  staffWorkStatusFilter?: string
  onStaffWorkStatusChange?: (status: string) => void
  staffWorkStatusOptions?: Array<{ value: string; label: string }>
  staffMembers: StaffSelectOption[]
  selectedStaffId: string
  onStaffChange: (staffId: string) => void
  showStaffFilter?: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  onClearFilters: () => void
}

const STATUS_OPTIONS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'hold', label: 'Hold' },
  { value: 'completed', label: 'Completed' },
]

export function ProjectsFilters({
  title,
  compact = false,
  statusFilter,
  onStatusChange,
  staffWorkStatusFilter,
  onStaffWorkStatusChange,
  staffWorkStatusOptions,
  staffMembers,
  selectedStaffId,
  onStaffChange,
  showStaffFilter = false,
  searchQuery,
  onSearchChange,
  onClearFilters,
}: ProjectsFiltersProps) {
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

  const hasStaffWorkStatusFilter =
    typeof staffWorkStatusFilter === 'string' &&
    staffWorkStatusFilter.trim() !== '' &&
    staffWorkStatusFilter !== 'all'
  const hasActiveFilters =
    statusFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    selectedStaffId !== '' ||
    hasStaffWorkStatusFilter

  const paddingClasses = compact
    ? 'px-3 py-2.5 sm:px-4 sm:py-3'
    : 'px-3 py-3 sm:px-4 sm:py-4 lg:px-6'
  const gapClasses = compact ? 'gap-3' : 'gap-4'

  return (
    <div className={`border-b border-slate-200 bg-white ${paddingClasses}`}>
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${gapClasses}`}>
        <div className={`flex flex-1 flex-col sm:flex-row sm:items-center ${gapClasses}`}>
          {title ? (
            <h2 className="text-lg font-semibold text-slate-900 sm:mr-2 sm:whitespace-nowrap">{title}</h2>
          ) : null}

          {/* Search Input */}
          <div className={`flex-1 ${compact ? 'sm:max-w-[13rem]' : 'sm:max-w-xs'}`}>
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
                placeholder="Search by project or client..."
                className="block w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className={`${compact ? 'sm:w-40' : 'sm:w-52'}`}>
            <ListboxDropdown
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => onStatusChange(v as ProjectStatus | 'all')}
              ariaLabel="Filter by status"
            />
          </div>

          {showStaffFilter && (
            <div className="sm:w-56">
              <ListboxDropdown
                value={selectedStaffId}
                options={[
                  { value: '', label: 'All Staff' },
                  ...staffMembers.map((staff) => ({
                    value: staff.id,
                    label: staff.full_name?.trim() || staff.email || 'Unnamed staff',
                  })),
                ]}
                onChange={onStaffChange}
                ariaLabel="Filter by staff"
              />
            </div>
          )}

          {staffWorkStatusOptions && staffWorkStatusOptions.length > 0 && onStaffWorkStatusChange ? (
            <div className={`${compact ? 'sm:w-40' : 'sm:w-56'}`}>
              <ListboxDropdown
                value={staffWorkStatusFilter ?? 'all'}
                options={staffWorkStatusOptions}
                onChange={onStaffWorkStatusChange}
                ariaLabel="Filter by staff work status"
              />
            </div>
          ) : null}
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className={`w-full rounded-lg text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap sm:w-auto ${compact ? 'px-3 py-1.5' : 'px-4 py-2'}`}
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  )
}
