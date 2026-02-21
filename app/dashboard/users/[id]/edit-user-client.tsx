'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ProjectsFilters } from '@/app/dashboard/projects/projects-filters'
import { ProjectsTable } from '@/app/dashboard/projects/projects-table'
import { ProjectsCardList } from '@/app/dashboard/projects/projects-card-list'
import { UserModal } from '@/app/components/users/user-modal'
import { UserPermissionsModal } from '@/app/components/users/user-permissions-modal'
import { useToast } from '@/app/components/ui/toast-context'
import { Tooltip } from '@/app/components/ui/tooltip'
import type {
  ProjectListItem,
  ProjectStatus,
  ProjectTeamMemberWorkStatus,
} from '@/lib/projects/actions'
import {
  updateUser,
  updateUserPermissions,
  type UserData,
  type ModulePermissions,
  type CreateUserFormData,
  type UpdateUserFormData,
} from '@/lib/users/actions'

type DetailTab = 'assigned-projects' | 'details'

type SortField =
  | 'name'
  | 'status'
  | 'start_date'
  | 'developer_deadline_date'
  | 'follow_up_date'
  | 'created_at'
  | 'project_amount'
  | null

type SortDirection = 'asc' | 'desc' | null
type StaffWorkFilterValue = 'all' | 'working' | 'hold'

type EditUserClientProps = {
  user: UserData
  canWrite: boolean
  assignedProjects: ProjectListItem[]
  assignedProjectsError: string | null
}

const USER_DETAIL_TAB_QUERY_PARAM = 'tab'

function parseUserDetailTab(value: string | null | undefined): DetailTab | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized === 'assigned-projects' || normalized === 'details'
    ? (normalized as DetailTab)
    : null
}

function getDisplayValue(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : '--'
}

function getRoleLabel(role: string) {
  if (!role) return '--'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function getUserInitials(user: UserData) {
  const source = user.full_name?.trim() || user.email?.trim() || 'U'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function formatDate(value: string | null | undefined) {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '--'
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function normalizePhoneForTel(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const normalized = raw.replace(/[^\d+]/g, '')
  return normalized.length > 0 ? normalized : null
}

function toUpdateUserPayload(
  source: UserData,
  overrides: Partial<UpdateUserFormData> = {}
): UpdateUserFormData {
  return {
    full_name: source.full_name ?? '',
    designation: source.designation ?? '',
    joining_date: source.joining_date ?? '',
    role: source.role,
    is_active: source.is_active,
    personal_email: source.personal_email ?? undefined,
    personal_mobile_no: source.personal_mobile_no ?? '',
    home_mobile_no: source.home_mobile_no ?? undefined,
    address: source.address ?? undefined,
    date_of_birth: source.date_of_birth ?? undefined,
    photo_url: source.photo_url ?? undefined,
    ...overrides,
  }
}

function getWorkStatusLabel(status?: ProjectTeamMemberWorkStatus | null) {
  if (status === 'start') return 'Working on'
  if (status === 'hold') return 'Hold'
  if (status === 'end') return 'Ended'
  return 'Not Started'
}

function getStaffWorkFilterValue(status?: ProjectTeamMemberWorkStatus | null): StaffWorkFilterValue | 'other' {
  if (status === 'start') return 'working'
  if (status === 'hold') return 'hold'
  return 'other'
}

function compareProjects(
  a: ProjectListItem,
  b: ProjectListItem,
  field: Exclude<SortField, null>,
  direction: Exclude<SortDirection, null>
) {
  const order = direction === 'asc' ? 1 : -1

  if (field === 'name') {
    return a.name.localeCompare(b.name) * order
  }

  if (field === 'status') {
    const statusRank: Record<ProjectStatus, number> = {
      pending: 0,
      in_progress: 1,
      hold: 2,
      completed: 3,
    }
    return (statusRank[a.status] - statusRank[b.status]) * order
  }

  if (field === 'project_amount') {
    return ((a.project_amount ?? 0) - (b.project_amount ?? 0)) * order
  }

  const dateA =
    field === 'start_date'
      ? a.start_date
      : field === 'developer_deadline_date'
        ? a.developer_deadline_date
        : field === 'follow_up_date'
          ? a.follow_up_date
          : a.created_at
  const dateB =
    field === 'start_date'
      ? b.start_date
      : field === 'developer_deadline_date'
        ? b.developer_deadline_date
        : field === 'follow_up_date'
          ? b.follow_up_date
          : b.created_at

  const timeA = dateA ? new Date(dateA).getTime() : 0
  const timeB = dateB ? new Date(dateB).getTime() : 0
  return (timeA - timeB) * order
}

function ProfilePreviewModal({
  isOpen,
  onClose,
  name,
  photoUrl,
  initials,
}: {
  isOpen: boolean
  onClose: () => void
  name: string
  photoUrl: string | null
  initials: string
}) {
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg bg-black/30 p-2 text-white transition-colors hover:bg-black/45"
        aria-label="Close profile preview"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="max-h-[88vh] max-w-[92vw]" onClick={(event) => event.stopPropagation()}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-7xl font-bold text-white shadow-2xl">
            {initials}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900 break-words">{value}</p>
    </div>
  )
}

function ContactInfoField({
  label,
  value,
  callHref,
}: {
  label: string
  value: string
  callHref?: string
}) {
  const hasValue = value !== '--'
  const isCallable = hasValue && Boolean(callHref)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {isCallable ? (
        <a
          href={callHref}
          className="mt-1 inline-block text-sm font-medium text-slate-900 break-words transition-colors hover:text-emerald-700 hover:underline"
          aria-label={`Call ${label}`}
        >
          {value}
        </a>
      ) : (
        <p className="mt-1 text-sm font-medium text-slate-900 break-words">{value}</p>
      )}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}

export function EditUserClient({
  user,
  canWrite,
  assignedProjects,
  assignedProjectsError,
}: EditUserClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { success: showSuccess, error: showError } = useToast()

  const [userState, setUserState] = useState<UserData>(user)
  const [activeTab, setActiveTab] = useState<DetailTab>(() =>
    parseUserDetailTab(searchParams.get(USER_DETAIL_TAB_QUERY_PARAM)) ?? 'assigned-projects'
  )
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isRightsModalOpen, setIsRightsModalOpen] = useState(false)
  const [isStatusUpdating, setIsStatusUpdating] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [staffWorkFilter, setStaffWorkFilter] = useState<StaffWorkFilterValue>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    setUserState(user)
  }, [user])

  const returnTo = useMemo(() => {
    const query = searchParams.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])

  const updateTabInUrl = useCallback(
    (tab: DetailTab) => {
      const params = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.search : searchParams.toString()
      )
      if (params.get(USER_DETAIL_TAB_QUERY_PARAM) === tab) {
        return
      }
      params.set(USER_DETAIL_TAB_QUERY_PARAM, tab)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    const rawTabParam = searchParams.get(USER_DETAIL_TAB_QUERY_PARAM)
    const parsedTab = parseUserDetailTab(rawTabParam)
    const resolvedTab: DetailTab = parsedTab ?? 'assigned-projects'

    setActiveTab((currentTab) => (currentTab === resolvedTab ? currentTab : resolvedTab))

    if (rawTabParam !== resolvedTab) {
      updateTabInUrl(resolvedTab)
    }
  }, [searchParams, updateTabInUrl])

  const filteredProjects = useMemo(() => {
    const term = searchQuery.trim().toLowerCase()
    const filtered = assignedProjects.filter((project) => {
      if (statusFilter !== 'all' && project.status !== statusFilter) {
        return false
      }

      if (staffWorkFilter !== 'all') {
        const workFilterValue = getStaffWorkFilterValue(project.my_work_status)
        if (workFilterValue !== staffWorkFilter) {
          return false
        }
      }

      if (term.length > 0) {
        const clientLabel = `${project.client_name ?? ''} ${project.client_company_name ?? ''}`.toLowerCase()
        const nameLabel = project.name.toLowerCase()
        if (!nameLabel.includes(term) && !clientLabel.includes(term)) {
          return false
        }
      }

      return true
    })

    if (!sortField || !sortDirection) {
      return filtered
    }

    return filtered
      .map((project, index) => ({ project, index }))
      .sort((a, b) => {
        const compareValue = compareProjects(
          a.project,
          b.project,
          sortField as Exclude<SortField, null>,
          sortDirection as Exclude<SortDirection, null>
        )
        if (compareValue !== 0) return compareValue
        return a.index - b.index
      })
      .map((item) => item.project)
  }, [assignedProjects, searchQuery, sortDirection, sortField, staffWorkFilter, statusFilter])

  const isFiltered =
    statusFilter !== 'all' || searchQuery.trim() !== '' || staffWorkFilter !== 'all'

  const buildProjectHref = (projectId: string) => {
    const params = new URLSearchParams()
    params.set('tab', 'tasks')
    params.set('from', 'user')
    params.set('userId', userState.id)
    params.set('returnTo', returnTo)
    return `/dashboard/projects/${encodeURIComponent(projectId)}?${params.toString()}`
  }

  const handleSort = (field: SortField) => {
    if (field === null) {
      setSortField(null)
      setSortDirection(null)
      return
    }

    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc')
      } else {
        setSortField(null)
        setSortDirection(null)
      }
      return
    }

    setSortField(field)
    setSortDirection('asc')
  }

  const handleTabChange = (tab: DetailTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    updateTabInUrl(tab)
  }

  const handleUserModalSubmit = async (formData: CreateUserFormData | UpdateUserFormData) => {
    if (!canWrite) {
      return { error: 'Permission denied', success: false }
    }

    const payload: UpdateUserFormData =
      'email' in formData
        ? {
            full_name: formData.full_name,
            designation: formData.designation,
            joining_date: formData.joining_date,
            role: formData.role,
            is_active: formData.is_active,
            personal_email: formData.personal_email,
            personal_mobile_no: formData.personal_mobile_no,
            home_mobile_no: formData.home_mobile_no,
            address: formData.address,
            date_of_birth: formData.date_of_birth,
            photo_url: formData.photo_url,
          }
        : formData

    const result = await updateUser(userState.id, payload)
    if (result.error) {
      showError('Update Failed', result.error)
      return { error: result.error, success: false }
    }

    setUserState((previous) => ({ ...previous, ...payload }))
    setIsEditModalOpen(false)
    showSuccess('User Updated', `${payload.full_name || userState.full_name || userState.email} has been updated.`)
    router.refresh()
    return { success: true }
  }

  const handlePermissionsSubmit = async (permissions: ModulePermissions) => {
    if (!canWrite) {
      return { error: 'Permission denied', success: false }
    }

    const result = await updateUserPermissions(userState.id, permissions)
    if (result.error) {
      showError('Update Failed', result.error)
      return { error: result.error, success: false }
    }

    setUserState((previous) => ({ ...previous, module_permissions: permissions }))
    setIsRightsModalOpen(false)
    showSuccess('Permissions Updated', `Module rights updated for ${userState.full_name || userState.email}.`)
    router.refresh()
    return { success: true }
  }

  const handleSetUserActive = async (nextActive: boolean) => {
    if (!canWrite || isStatusUpdating || nextActive === userState.is_active) return

    setIsStatusUpdating(true)
    const payload = toUpdateUserPayload(userState, { is_active: nextActive })
    const result = await updateUser(userState.id, payload)
    setIsStatusUpdating(false)

    if (result.error) {
      showError('Status Update Failed', result.error)
      return
    }

    setUserState((previous) => ({ ...previous, is_active: nextActive }))
    showSuccess('Status Updated', nextActive ? 'User activated.' : 'User deactivated.')
    router.refresh()
  }

  const userLabel = userState.full_name || userState.email || 'User'
  const userInitials = getUserInitials(userState)
  const personalMobileTel = normalizePhoneForTel(userState.personal_mobile_no)
  const homeMobileTel = normalizePhoneForTel(userState.home_mobile_no)

  return (
    <>
      <div className="flex h-full flex-col gap-2 sm:gap-3">
        <div className="flex-shrink-0 rounded-2xl border border-slate-200/80 bg-white px-3 pt-1.5 pb-0.5 sm:px-4 sm:pt-2">
          <div
            className="flex items-stretch overflow-x-auto scrollbar-hide"
            role="tablist"
            aria-label="User detail sections"
          >
            {[
              { id: 'assigned-projects' as const, label: 'Assigned Projects' },
              { id: 'details' as const, label: 'Details' },
            ].map(({ id, label }, index) => {
              const isActive = activeTab === id
              const isLast = index === 1
              return (
                <div key={id} className="flex items-stretch">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={id === 'assigned-projects' ? 'panel-assigned-projects' : 'panel-details'}
                    id={id === 'assigned-projects' ? 'tab-assigned-projects' : 'tab-details'}
                    onClick={() => handleTabChange(id)}
                    className={`
                      relative px-2.5 pb-2 pt-1 text-sm font-semibold whitespace-nowrap transition-colors duration-200 cursor-pointer
                      border-b-2
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white
                      ${isActive
                        ? 'text-[#06B6D4] border-[#06B6D4]'
                        : 'text-slate-600 border-transparent hover:text-slate-800'}
                    `}
                  >
                    {label}
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

        {activeTab === 'assigned-projects' ? (
          <div
            id="panel-assigned-projects"
            role="tabpanel"
            aria-labelledby="tab-assigned-projects"
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
          >
            {assignedProjectsError ? (
              <div className="flex-shrink-0 border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                Failed to load assigned projects: {assignedProjectsError}
              </div>
            ) : null}

            <ProjectsFilters
              compact
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              staffWorkStatusFilter={staffWorkFilter}
              onStaffWorkStatusChange={(value) => setStaffWorkFilter(value as StaffWorkFilterValue)}
              staffWorkStatusOptions={[
                { value: 'all', label: 'All Staff Status' },
                { value: 'working', label: 'Working' },
                { value: 'hold', label: 'Hold' },
              ]}
              staffMembers={[]}
              selectedStaffId=""
              onStaffChange={() => undefined}
              showStaffFilter={false}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onClearFilters={() => {
                setStatusFilter('all')
                setStaffWorkFilter('all')
                setSearchQuery('')
              }}
            />

            <div className="min-h-0 flex-1 overflow-auto pt-1">
              <div className="md:hidden">
                <ProjectsCardList
                  projects={filteredProjects}
                  canWrite={false}
                  showClientColumn
                  showWorkingStatus
                  getWorkingStatusLabel={(project) => getWorkStatusLabel(project.my_work_status)}
                  buildProjectHref={buildProjectHref}
                  onView={(projectId) => router.push(buildProjectHref(projectId))}
                  onEdit={() => undefined}
                  onDelete={() => undefined}
                  isFiltered={isFiltered}
                  hasMore={false}
                  loadingMore={false}
                  onLoadMore={() => undefined}
                />
              </div>

              <div className="hidden h-full md:block">
                <ProjectsTable
                  projects={filteredProjects}
                  canWrite={false}
                  showClientColumn
                  buildProjectHref={buildProjectHref}
                  showWorkingStatusColumn
                  getWorkingStatusLabel={(project) => getWorkStatusLabel(project.my_work_status)}
                  onView={(projectId) => router.push(buildProjectHref(projectId))}
                  onEdit={() => undefined}
                  onDelete={() => undefined}
                  sortField={sortField}
                  sortDirection={sortDirection ?? undefined}
                  onSort={handleSort}
                  isFiltered={isFiltered}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            id="panel-details"
            role="tabpanel"
            aria-labelledby="tab-details"
            className="min-h-0 flex-1 overflow-hidden"
          >
            <div className="flex h-full flex-col gap-3 overflow-y-auto lg:flex-row lg:overflow-hidden">
              <div className="w-full lg:w-[340px] lg:flex-shrink-0 lg:overflow-y-auto">
                <div className="pb-3 lg:pb-0">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Profile & Account</h3>
                      <div className="flex items-center gap-1.5">
                        <Tooltip content="View photo">
                          <button
                            type="button"
                            onClick={() => setShowProfileModal(true)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-cyan-700"
                            aria-label="Open profile image"
                          >
                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.55-4.55M19 5h-3m3 0v3M9 14l-4.55 4.55M5 19h3m-3 0v-3" />
                            </svg>
                          </button>
                        </Tooltip>

                        {canWrite ? (
                          <>
                            <Tooltip content="Edit user">
                              <button
                                type="button"
                                onClick={() => setIsEditModalOpen(true)}
                                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                aria-label="Edit user"
                              >
                                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </Tooltip>
                            <Tooltip content="Manage rights">
                              <button
                                type="button"
                                onClick={() => setIsRightsModalOpen(true)}
                                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-cyan-50 hover:text-cyan-700"
                                aria-label="Manage user rights"
                              >
                                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                              </button>
                            </Tooltip>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                      {userState.photo_url ? (
                        <img
                          src={userState.photo_url}
                          alt={userLabel}
                          className="h-24 w-24 rounded-full border border-slate-200 object-cover shadow-sm"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-3xl font-bold text-white shadow-sm">
                          {userInitials}
                        </div>
                      )}
                      <div className="w-full">
                        <p className="truncate text-base font-semibold text-slate-900">{userLabel}</p>
                        <p className="truncate text-sm text-slate-500">{getDisplayValue(userState.designation)}</p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span
                            className={`text-sm font-semibold ${
                              userState.is_active ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {userState.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={userState.is_active}
                            aria-label="Toggle user status"
                            disabled={!canWrite || isStatusUpdating}
                            onClick={() => handleSetUserActive(!userState.is_active)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              userState.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                            } ${!canWrite || isStatusUpdating ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                userState.is_active ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                      <MetaRow label="Role" value={getRoleLabel(userState.role)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full lg:min-w-0 lg:flex-1 lg:overflow-y-auto">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">User Information</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoField label="Company Email" value={getDisplayValue(userState.email)} />
                    <InfoField label="Personal Email" value={getDisplayValue(userState.personal_email)} />
                    <ContactInfoField
                      label="Personal Mobile"
                      value={getDisplayValue(userState.personal_mobile_no)}
                      callHref={personalMobileTel ? `tel:${personalMobileTel}` : undefined}
                    />
                    <ContactInfoField
                      label="Home Mobile"
                      value={getDisplayValue(userState.home_mobile_no)}
                      callHref={homeMobileTel ? `tel:${homeMobileTel}` : undefined}
                    />
                    <InfoField label="Joining Date" value={formatDate(userState.joining_date)} />
                    <InfoField label="Date of Birth" value={formatDate(userState.date_of_birth)} />
                    <InfoField label="Created At" value={formatDate(userState.created_at)} />
                    <InfoField label="Address" value={getDisplayValue(userState.address)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <UserModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        mode="edit"
        initialData={userState}
        readOnly={!canWrite}
        onSubmit={handleUserModalSubmit}
      />

      <UserPermissionsModal
        isOpen={isRightsModalOpen}
        onClose={() => setIsRightsModalOpen(false)}
        user={userState}
        onSubmit={handlePermissionsSubmit}
      />

      <ProfilePreviewModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        name={userLabel}
        photoUrl={userState.photo_url}
        initials={userInitials}
      />
    </>
  )
}
