'use client'

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
  technologyTools?: Array<{ id: string; name: string }>
  selectedTechnologyToolId?: string
  onTechnologyChange?: (id: string) => void
  onClearFilters: () => void
}

const STATUS_TAB_OPTIONS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
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
  technologyTools,
  selectedTechnologyToolId,
  onTechnologyChange,
  onClearFilters,
}: ProjectsFiltersProps) {
  const normalizedTechnologyToolId = selectedTechnologyToolId ?? ''
  const normalizedStaffWorkStatus = staffWorkStatusFilter ?? 'all'

  const hasStaffWorkStatusFilter =
    normalizedStaffWorkStatus.trim() !== '' &&
    normalizedStaffWorkStatus !== 'all'
  const hasActiveFilters =
    statusFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    selectedStaffId !== '' ||
    normalizedTechnologyToolId !== '' ||
    hasStaffWorkStatusFilter

  const paddingClasses = compact
    ? 'px-3 py-1.5 sm:px-4 sm:py-2'
    : 'px-3 py-2 sm:px-4 sm:py-2.5 lg:px-6'
  const toolbarGapClasses = compact ? 'gap-1.5' : 'gap-2'
  const denseControlClasses = compact
    ? 'min-h-8 rounded-md px-2 text-[13px]'
    : 'min-h-[34px] rounded-md px-2 text-[13px]'
  const searchWidthClasses = compact
    ? 'w-[10.5rem]'
    : 'w-[12rem] lg:w-[13rem]'
  const standardFilterWidthClasses = compact ? 'w-[8.5rem]' : 'w-[9.5rem]'
  const technologyFilterWidthClasses = compact ? 'w-[8.5rem]' : 'w-[9.5rem]'

  return (
    <div className={`border-b border-slate-200 bg-white ${paddingClasses}`}>
      <div className={`flex min-w-0 flex-nowrap items-center ${toolbarGapClasses}`}>
        <div className={`flex min-w-0 flex-1 items-center ${toolbarGapClasses}`}>
          {title ? (
            <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
          ) : null}

          <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex min-w-max items-stretch" aria-label="Project status filters">
              {STATUS_TAB_OPTIONS.map((option, index) => {
                const isActive = statusFilter === option.value
                const isLast = index === STATUS_TAB_OPTIONS.length - 1

                return (
                  <div key={option.value} className="flex items-stretch">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onStatusChange(option.value)}
                      className={`
                        relative whitespace-nowrap border-b-2 px-2 pb-1.5 pt-1 text-[13px] font-semibold transition-colors duration-200
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white
                        ${
                          isActive
                            ? 'border-[#06B6D4] text-[#06B6D4]'
                            : 'border-transparent text-slate-600 hover:text-slate-800'
                        }
                      `}
                    >
                      {option.label}
                    </button>
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className="mx-2 w-px self-stretch bg-gradient-to-b from-slate-200/0 via-slate-200/70 to-slate-200/0 sm:mx-3"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className={`flex flex-shrink-0 items-center ${toolbarGapClasses}`}>
          <div className={searchWidthClasses}>
            <SearchInput
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Search projects..."
              debounceMs={SEARCH_DEBOUNCE_MS}
              inputClassName="min-h-8 rounded-md py-1.5 pl-9 pr-3 text-[13px]"
            />
          </div>

          {showStaffFilter && (
            <div className={standardFilterWidthClasses}>
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
                className={denseControlClasses}
              />
            </div>
          )}

          {technologyTools && onTechnologyChange ? (
            <div className={technologyFilterWidthClasses}>
              <ListboxDropdown
                value={normalizedTechnologyToolId}
                options={[
                  { value: '', label: 'All Technology' },
                  ...technologyTools.map((tool) => ({
                    value: tool.id,
                    label: tool.name,
                  })),
                ]}
                onChange={onTechnologyChange}
                ariaLabel="Filter by technology"
                searchable={true}
                className={denseControlClasses}
              />
            </div>
          ) : null}

          {staffWorkStatusOptions && staffWorkStatusOptions.length > 0 && onStaffWorkStatusChange ? (
            <div className={standardFilterWidthClasses}>
              <ListboxDropdown
                value={normalizedStaffWorkStatus}
                options={staffWorkStatusOptions}
                onChange={onStaffWorkStatusChange}
                ariaLabel="Filter by staff work status"
                className={denseControlClasses}
              />
            </div>
          ) : null}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              aria-label="Clear filters"
              title="Clear filters"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4]/20"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
