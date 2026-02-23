import { useState, useEffect } from 'react'
import { UserRole } from '@/lib/users/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import { SearchInput } from '@/app/components/ui/search-input'

interface UsersFiltersProps {
    roleFilter: UserRole | 'all'
    onRoleChange: (role: UserRole | 'all') => void
    searchQuery: string
    onSearchChange: (query: string) => void
    onClearFilters: () => void
}

const ROLE_OPTIONS: { value: UserRole | 'all'; label: string }[] = [
    { value: 'all', label: 'All Roles' },
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'staff', label: 'Staff' },
    { value: 'client', label: 'Client' },
]

// Status options removed as manual activation/deactivation is replaced by soft-delete

export function UsersFilters({
    roleFilter,
    onRoleChange,
    searchQuery,
    onSearchChange,
    onClearFilters,
}: UsersFiltersProps) {
    // Debounced search logic removed as handled by SearchInput component

    const hasActiveFilters =
        roleFilter !== 'all' || searchQuery.trim() !== ''

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
                            placeholder="Search by name or email..."
                        />
                    </div>

                    {/* Role Filter */}
                    <div className="sm:w-40">
                        <ListboxDropdown
                            value={roleFilter}
                            options={ROLE_OPTIONS}
                            onChange={(v) => onRoleChange(v as UserRole | 'all')}
                            ariaLabel="Filter by role"
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
