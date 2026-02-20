import { useState, useEffect } from 'react'
import { UserRole } from '@/lib/users/actions'

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
    const [localSearch, setLocalSearch] = useState(searchQuery)

    // Sync local search with external prop (e.g. when clear filters is clicked)
    useEffect(() => {
        setLocalSearch(searchQuery)
    }, [searchQuery])

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== searchQuery) {
                onSearchChange(localSearch)
            }
        }, 350)
        return () => clearTimeout(timer)
    }, [localSearch, onSearchChange, searchQuery])

    const hasActiveFilters =
        roleFilter !== 'all' || searchQuery.trim() !== ''

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
                                placeholder="Search by name or email..."
                                className="block w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20"
                            />
                        </div>
                    </div>

                    {/* Role Filter */}
                    <div className="sm:w-40">
                        <select
                            value={roleFilter}
                            onChange={(e) => onRoleChange(e.target.value as UserRole | 'all')}
                            className="block w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-[#1E1B4B] shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20"
                        >
                            {ROLE_OPTIONS.map((option) => (
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
