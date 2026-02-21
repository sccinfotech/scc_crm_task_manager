'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SidebarToggleButton } from '@/app/components/dashboard/sidebar-context'
import { Pagination } from '@/app/components/ui/pagination'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import { useToast } from '@/app/components/ui/toast-context'
import {
  deleteActivityLogsByDateRange,
  type ActivityLogEntry,
  type ActivityLogActionType,
  type ActivityLogStatusFilter,
} from '@/lib/activity-log/actions'
import type { StaffSelectOption } from '@/lib/users/actions'

const ACTION_TYPES: { value: ActivityLogActionType | ''; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'Create', label: 'Create' },
  { value: 'Update', label: 'Update' },
  { value: 'Delete', label: 'Delete' },
  { value: 'Login', label: 'Login' },
  { value: 'Logout', label: 'Logout' },
]

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'Auth', label: 'Auth' },
  { value: 'Leads', label: 'Leads' },
  { value: 'Clients', label: 'Clients' },
  { value: 'Projects', label: 'Projects' },
  { value: 'User Management', label: 'User Management' },
  { value: 'Logs', label: 'Logs' },
]

const STATUS_OPTIONS: { value: ActivityLogStatusFilter; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'Success', label: 'Success' },
  { value: 'Failed', label: 'Failed' },
]

type SortField = 'created_at' | 'user_name' | 'action_type' | 'module_name' | 'status'

interface LogsClientProps {
  logs: ActivityLogEntry[]
  totalCount: number
  page: number
  pageSize: number
  initialFromDate: string
  initialToDate: string
  initialUserId: string
  initialActionType: string
  initialModuleName: string
  initialStatus: ActivityLogStatusFilter
  initialSearch: string
  initialSortField: SortField
  initialSortDirection: 'asc' | 'desc'
  staffOptions: StaffSelectOption[]
  canWrite: boolean
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

function StatusPill({ status }: { status: string }) {
  const isSuccess = status === 'Success'
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        isSuccess ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-red-50 text-red-700 ring-1 ring-red-600/20'
      }`}
    >
      {status}
    </span>
  )
}

export function LogsClient({
  logs,
  totalCount,
  page,
  pageSize,
  initialFromDate,
  initialToDate,
  initialUserId,
  initialActionType,
  initialModuleName,
  initialStatus,
  initialSearch,
  initialSortField,
  initialSortDirection,
  staffOptions,
  canWrite,
}: LogsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { success: showSuccess, error: showError } = useToast()
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteFromDate, setDeleteFromDate] = useState(initialFromDate)
  const [deleteToDate, setDeleteToDate] = useState(initialToDate)
  const [deleting, setDeleting] = useState(false)
  // Local filter state for controlled inputs/dropdowns (synced from URL/initial props)
  const [localFromDate, setLocalFromDate] = useState(initialFromDate)
  const [localToDate, setLocalToDate] = useState(initialToDate)
  const [localUser, setLocalUser] = useState(initialUserId)
  const [localActionType, setLocalActionType] = useState(initialActionType)
  const [localModule, setLocalModule] = useState(initialModuleName)
  const [localStatus, setLocalStatus] = useState(initialStatus)
  const [localSearch, setLocalSearch] = useState(initialSearch)

  useEffect(() => {
    setLocalFromDate(initialFromDate)
    setLocalToDate(initialToDate)
    setLocalUser(initialUserId)
    setLocalActionType(initialActionType)
    setLocalModule(initialModuleName)
    setLocalStatus(initialStatus)
    setLocalSearch(initialSearch)
  }, [initialFromDate, initialToDate, initialUserId, initialActionType, initialModuleName, initialStatus, initialSearch])

  const buildSearchParams = useCallback(
    (updates: {
      fromDate?: string
      toDate?: string
      user?: string
      actionType?: string
      module?: string
      status?: string
      search?: string
      sort?: SortField | null
      sortDir?: string
      page?: number
    }) => {
      const params = new URLSearchParams()
      const from = updates.fromDate ?? initialFromDate
      const to = updates.toDate ?? initialToDate
      params.set('fromDate', from)
      params.set('toDate', to)
      if (updates.user !== undefined && updates.user) params.set('user', updates.user)
      if (updates.actionType !== undefined && updates.actionType) params.set('actionType', updates.actionType)
      if (updates.module !== undefined && updates.module) params.set('module', updates.module)
      if (updates.status !== undefined && updates.status !== 'all') params.set('status', updates.status)
      if (updates.search !== undefined && updates.search) params.set('search', updates.search)
      const sort = updates.sort ?? initialSortField
      const sortDir = updates.sortDir ?? initialSortDirection
      if (sort) {
        params.set('sort', sort)
        params.set('sortDir', sortDir)
      }
      if ((updates.page ?? page) > 1) params.set('page', String(updates.page ?? page))
      return params.toString()
    },
    [
      initialFromDate,
      initialToDate,
      initialUserId,
      initialActionType,
      initialModuleName,
      initialStatus,
      initialSearch,
      initialSortField,
      initialSortDirection,
      page,
    ]
  )

  const handleSort = (field: SortField) => {
    const nextDir =
      initialSortField === field
        ? initialSortDirection === 'asc'
          ? 'desc'
          : 'asc'
        : 'desc'
    router.push(
      `${pathname}?${buildSearchParams({
        sort: field,
        sortDir: nextDir,
        page: 1,
      })}`
    )
  }

  const handleConfirmDelete = async () => {
    if (!deleteFromDate?.trim() || !deleteToDate?.trim()) {
      showError('Invalid Range', 'From date and to date are required.')
      return
    }
    setDeleting(true)
    const result = await deleteActivityLogsByDateRange(deleteFromDate.trim(), deleteToDate.trim())
    setDeleting(false)
    setDeleteModalOpen(false)
    if (result.error) {
      showError('Delete Failed', result.error)
      return
    }
    showSuccess('Logs Deleted', `Deleted ${result.deletedCount ?? 0} log(s).`)
    router.refresh()
  }

  const userOptions = [
    { value: '', label: 'All Users' },
    ...staffOptions.map((s) => ({
      value: s.id,
      label: (s.full_name || s.email || s.id).trim() || 'Unknown',
    })),
  ]

  const hasActiveFilters =
    localUser !== '' ||
    localActionType !== '' ||
    localModule !== '' ||
    localStatus !== 'all' ||
    localSearch.trim() !== ''

  const handleApplyFilters = () => {
    router.push(
      `${pathname}?${buildSearchParams({
        fromDate: localFromDate,
        toDate: localToDate,
        user: localUser || undefined,
        actionType: localActionType || undefined,
        module: localModule || undefined,
        status: localStatus !== 'all' ? localStatus : undefined,
        search: localSearch.trim() || undefined,
        page: 1,
      })}`
    )
  }

  const handleClearFilters = () => {
    setLocalUser('')
    setLocalActionType('')
    setLocalModule('')
    setLocalStatus('all')
    setLocalSearch('')
    router.push(
      `${pathname}?${buildSearchParams({
        fromDate: initialFromDate,
        toDate: initialToDate,
        user: '',
        actionType: '',
        module: '',
        status: 'all',
        search: '',
        page: 1,
      })}`
    )
  }

  return (
    <>
      <div className="flex h-full flex-col p-3 sm:p-4 lg:p-6">
        {/* Page Title and optional actions (match Projects) */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
          <div className="flex items-center gap-3">
            <SidebarToggleButton />
            <h1 className="text-xl font-semibold text-[#1E1B4B] sm:text-2xl">Activity Logs</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {canWrite && (
              <button
                type="button"
                onClick={() => {
                  setDeleteFromDate(initialFromDate)
                  setDeleteToDate(initialToDate)
                  setDeleteModalOpen(true)
                }}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 sm:px-4 sm:py-2.5"
              >
                Delete by date range
              </button>
            )}
            <button
              type="button"
              onClick={() => router.refresh()}
              title="Refresh"
              aria-label="Refresh activity logs"
              className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:px-3 sm:py-2.5"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Full-height white card: filters + toolbar + table + pagination (match Projects) */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-sm">
          {/* Filters */}
          <div className="border-b border-slate-200 bg-white px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">From Date</label>
                  <input
                    type="date"
                    value={localFromDate}
                    onChange={(e) => setLocalFromDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 min-h-9"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">To Date</label>
                  <input
                    type="date"
                    value={localToDate}
                    onChange={(e) => setLocalToDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 min-h-9"
                  />
                </div>
                <div className="w-40 sm:w-52">
                  <label className="mb-1 block text-xs font-medium text-slate-500">User</label>
                  <ListboxDropdown
                    value={localUser}
                    options={userOptions}
                    onChange={setLocalUser}
                    ariaLabel="Filter by user"
                  />
                </div>
                <div className="w-36 sm:w-40">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Action</label>
                  <ListboxDropdown
                    value={localActionType}
                    options={ACTION_TYPES}
                    onChange={setLocalActionType}
                    ariaLabel="Filter by action"
                  />
                </div>
                <div className="w-40 sm:w-44">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Module</label>
                  <ListboxDropdown
                    value={localModule}
                    options={MODULE_OPTIONS}
                    onChange={setLocalModule}
                    ariaLabel="Filter by module"
                  />
                </div>
                <div className="w-28 sm:w-36">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                  <ListboxDropdown
                    value={localStatus}
                    options={STATUS_OPTIONS}
                    onChange={setLocalStatus}
                    ariaLabel="Filter by status"
                  />
                </div>
                <div className="min-w-[180px] flex-1 sm:max-w-xs">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Search</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={localSearch}
                      onChange={(e) => setLocalSearch(e.target.value)}
                      placeholder="Keyword..."
                      className="block w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-700 placeholder-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 min-h-9"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="rounded-xl border border-transparent bg-[#06B6D4] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0891B2] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 sm:px-5 sm:py-2.5"
                >
                  Apply
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:px-5 sm:py-2.5"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-700 sm:px-6">
                  <button
                    type="button"
                    onClick={() => handleSort('created_at')}
                    className="group flex items-center gap-1"
                  >
                    Date & Time
                    {initialSortField === 'created_at' && (
                      <span className="text-[#06B6D4]">{initialSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-700 sm:px-6">
                  <button type="button" onClick={() => handleSort('user_name')} className="group flex items-center gap-1">
                    User Name
                    {initialSortField === 'user_name' && (
                      <span className="text-[#06B6D4]">{initialSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-700 sm:px-6">
                  <button type="button" onClick={() => handleSort('action_type')} className="group flex items-center gap-1">
                    Action Type
                    {initialSortField === 'action_type' && (
                      <span className="text-[#06B6D4]">{initialSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-700 sm:px-6">
                  <button type="button" onClick={() => handleSort('module_name')} className="group flex items-center gap-1">
                    Module Name
                    {initialSortField === 'module_name' && (
                      <span className="text-[#06B6D4]">{initialSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-700 sm:px-6">Description</th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-700 sm:px-6">
                  <button type="button" onClick={() => handleSort('status')} className="group flex items-center gap-1">
                    Status
                    {initialSortField === 'status' && (
                      <span className="text-[#06B6D4]">{initialSortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-700 sm:px-6">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border-b border-slate-200 px-4 py-8 text-center text-slate-500 sm:px-6">
                    No activity logs found for the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700 sm:px-6">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 text-slate-700 sm:px-6">{log.user_name}</td>
                    <td className="px-4 py-3 text-slate-700 sm:px-6">{log.action_type}</td>
                    <td className="px-4 py-3 text-slate-700 sm:px-6">{log.module_name}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-slate-700 sm:px-6" title={log.description}>
                      {log.description}
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <StatusPill status={log.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 sm:px-6">{log.ip_address ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

          <Pagination
            currentPage={page}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={(p) =>
              router.push(`${pathname}?${buildSearchParams({ page: p })}`)
            }
            className="sm:px-6"
          />
        </div>
      </div>

      {/* Delete by date range modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeleteModalOpen(false)} aria-hidden />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-[#1E1B4B]">Delete activity logs by date range</h3>
            <p className="mt-2 text-sm text-gray-600">
              This action is irreversible. All logs between the selected dates will be permanently deleted. This
              deletion will be recorded in the activity log.
            </p>
            <div className="mt-4 flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500">From Date</label>
                <input
                  type="date"
                  value={deleteFromDate}
                  onChange={(e) => setDeleteFromDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500">To Date</label>
                <input
                  type="date"
                  value={deleteToDate}
                  onChange={(e) => setDeleteToDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting || !deleteFromDate?.trim() || !deleteToDate?.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete logs'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
