'use client'

import { useState, useEffect } from 'react'
import { ProjectStatus } from '@/lib/projects/actions'
import type { StaffSelectOption } from '@/lib/users/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import { SearchInput } from '@/app/components/ui/search-input'

const SEARCH_DEBOUNCE_MS = 350

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
  // Debounced search logic removed as handled by SearchInput component

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
            <SearchInput
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search by project or client..."
              debounceMs={SEARCH_DEBOUNCE_MS}
            />
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
