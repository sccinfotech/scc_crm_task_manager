'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import {
  Project,
  ProjectStatus,
  ProjectFollowUp,
  ProjectPriority,
  getProjectDetailsSupplement,
  updateProject,
  updateProjectLinks,
  updateProjectStatus,
  updateMyProjectWorkStatus,
  deleteProject,
  ProjectFormData,
  ProjectListItem,
} from '@/lib/projects/actions'
import { calculateStaffApproxDeadline } from '@/lib/projects/utils'
import type { ProjectTeamMember, ProjectTeamMemberWorkStatus } from '@/lib/projects/actions'
import { getClientsForSelect, type ClientSelectOption } from '@/lib/clients/actions'
import { getTechnologyTools, type TechnologyTool } from '@/lib/settings/technology-tools-actions'
import { getStaffForSelect, type StaffSelectOption } from '@/lib/users/actions'
import { ProjectDetailRightPanel, type RightPanelTab } from '../project-detail-right-panel'
import { ProjectWorkStatusBar } from '../project-work-status-bar'
import { ProjectModal } from '../project-modal'
import { DeleteConfirmModal } from '../delete-confirm-modal'

/** Lazy load heavy tab components for faster initial page load */
const ProjectRequirements = dynamic(() => import('../project-requirements').then((m) => m.ProjectRequirements), {
  loading: () => <div className="flex h-64 items-center justify-center text-slate-500">Loading requirements…</div>,
  ssr: false,
})

const ProjectTasks = dynamic(() => import('../project-tasks').then((m) => m.ProjectTasks), {
  loading: () => <div className="flex h-64 items-center justify-center text-slate-500">Loading tasks…</div>,
  ssr: false,
})

interface ProjectDetailViewProps {
  project: Project
  initialFollowUps?: ProjectFollowUp[]
  initialTab?: string
  canManageProject: boolean
  canManageFollowUps: boolean
  canViewAmount: boolean
  userRole: string
  currentUserId?: string
  clients: ClientSelectOption[]
  clientsError: string | null
  technologyTools: TechnologyTool[]
  technologyToolsError: string | null
  teamMembers: StaffSelectOption[]
  teamMembersError: string | null
  initialClientsLoaded?: boolean
  initialTechnologyToolsLoaded?: boolean
  initialTeamMembersLoaded?: boolean
}

const STATUS_STYLES: Record<ProjectStatus, string> = {
  pending: 'bg-slate-200 text-slate-800 border-slate-300 ring-1 ring-slate-300/50',
  in_progress: 'bg-sky-200 text-sky-900 border-sky-400 ring-1 ring-sky-400/50',
  hold: 'bg-amber-200 text-amber-900 border-amber-400 ring-1 ring-amber-400/50',
  completed: 'bg-emerald-200 text-emerald-900 border-emerald-500 ring-1 ring-emerald-500/50',
}
const STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  hold: 'Hold',
  completed: 'Completed',
}

function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function StatusSegment({
  status,
  onStatusChange,
  disabled,
}: {
  status: ProjectStatus
  onStatusChange: (next: ProjectStatus) => void
  disabled?: boolean
}) {
  const handleSelect = (next: ProjectStatus) => {
    if (next !== status && !disabled) {
      onStatusChange(next)
    }
  }

  const iconClass = 'h-3.5 w-3.5'
  const segmentButtons: { status: ProjectStatus; label: string; icon: React.ReactNode }[] = [
    {
      status: 'pending',
      label: 'Pending',
      icon: (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      status: 'in_progress',
      label: 'In Progress',
      icon: (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      status: 'hold',
      label: 'Hold',
      icon: (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      status: 'completed',
      label: 'Completed',
      icon: (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div
      className="inline-flex gap-0.5 rounded-lg border border-slate-200 bg-slate-50/50 p-0.5 shadow-sm"
      role="group"
      aria-label="Project status"
    >
      {segmentButtons.map(({ status: s, label, icon }) => {
        const isSelected = s === status
        const button = (
          <button
            type="button"
            onClick={() => handleSelect(s)}
            disabled={disabled}
            aria-pressed={isSelected}
            aria-label={label}
            className={`
              flex items-center justify-center w-8 h-8 rounded-md
              transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1
              ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
              ${isSelected
                ? `${STATUS_STYLES[s]} border shadow-sm ring-1 ring-black/5`
                : 'text-slate-500 hover:bg-white hover:text-slate-700 hover:border-slate-200 border border-transparent'}
            `}
          >
            {icon}
          </button>
        )
        return (
          <Tooltip key={s} content={label}>
            {button}
          </Tooltip>
        )
      })}
    </div>
  )
}

function PriorityPill({ priority }: { priority: ProjectPriority }) {
  const priorityStyles = {
    urgent: 'bg-rose-200 text-rose-900 border-rose-400',
    high: 'bg-orange-200 text-orange-900 border-orange-400',
    medium: 'bg-slate-200 text-slate-800 border-slate-300',
    low: 'bg-emerald-200 text-emerald-800 border-emerald-400',
  }
  const priorityLabels = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border ${priorityStyles[priority]}`}>
      {priorityLabels[priority]}
    </span>
  )
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '--'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatWorkStatus(status: ProjectTeamMemberWorkStatus | undefined) {
  if (!status || status === 'not_started') return 'Not started'
  if (status === 'start') return 'In progress'
  if (status === 'hold') return 'On hold'
  return 'Ended'
}

function formatWorkSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h < 24) return rem > 0 ? `${h}h ${rem}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`
}

function getMemberTodayWorkSeconds(member: ProjectTeamMember, nowMs = Date.now()): number {
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayBreakdown = member.work_day_breakdown?.find((entry) => entry.date === todayKey)?.seconds ?? 0
  const status = member.work_status ?? 'not_started'
  const runningSince = member.work_running_since

  if (status !== 'start' || !runningSince) {
    return todayBreakdown
  }

  const runningStartMs = new Date(runningSince).getTime()
  if (Number.isNaN(runningStartMs)) {
    return todayBreakdown
  }

  const todayStartMs = new Date(`${todayKey}T00:00:00.000Z`).getTime()
  const runningSegmentTodaySeconds = Math.max(0, (nowMs - Math.max(runningStartMs, todayStartMs)) / 1000)
  return todayBreakdown + runningSegmentTodaySeconds
}

function parseLinks(value: string | null) {
  if (!value) return []
  return value
    .split(',')
    .map((link) => link.trim())
    .filter(Boolean)
}

function normalizeLink(url: string) {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

type ProjectDetailTab = 'details' | 'payments' | 'requirements' | 'tasks'

const PROJECT_DETAIL_TABS: { id: ProjectDetailTab; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'payments', label: 'Payments' },
  { id: 'details', label: 'Details' },
]

const DETAILS_PANEL_QUERY_PARAM = 'detailsTab'
const RIGHT_PANEL_TABS: RightPanelTab[] = ['follow-ups', 'work-history', 'analytics', 'my-notes', 'team-talk']
const ADMIN_MANAGER_RIGHT_PANEL_TABS: RightPanelTab[] = ['follow-ups', 'work-history', 'analytics', 'my-notes', 'team-talk']
const NON_STAFF_RIGHT_PANEL_TABS: RightPanelTab[] = ['follow-ups', 'work-history', 'my-notes', 'team-talk']
const STAFF_RIGHT_PANEL_TABS: RightPanelTab[] = ['work-history', 'my-notes', 'team-talk']

function getVisibleRightPanelTabs(userRole: string): RightPanelTab[] {
  if (userRole === 'staff') return STAFF_RIGHT_PANEL_TABS
  if (userRole === 'admin' || userRole === 'manager') return ADMIN_MANAGER_RIGHT_PANEL_TABS
  return NON_STAFF_RIGHT_PANEL_TABS
}

function parseProjectDetailTab(value: string | null | undefined): ProjectDetailTab | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return PROJECT_DETAIL_TABS.some((tab) => tab.id === normalized)
    ? (normalized as ProjectDetailTab)
    : null
}

function parseRightPanelTab(value: string | null | undefined): RightPanelTab | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return RIGHT_PANEL_TABS.includes(normalized as RightPanelTab)
    ? (normalized as RightPanelTab)
    : null
}

function resolveRightPanelTab(tab: RightPanelTab | null, userRole: string): RightPanelTab {
  const isStaff = userRole === 'staff'
  const defaultTab: RightPanelTab = isStaff ? 'work-history' : 'follow-ups'
  const visibleTabs = getVisibleRightPanelTabs(userRole)
  if (!tab) return defaultTab
  if (!visibleTabs.includes(tab)) {
    return defaultTab
  }

  return tab
}

function resolveProjectDetailTab(
  tab: ProjectDetailTab | null,
  showRequirementsAndPayments: boolean
): ProjectDetailTab {
  if (!tab) return 'tasks'
  if (!showRequirementsAndPayments && (tab === 'requirements' || tab === 'payments')) {
    return 'tasks'
  }
  return tab
}

function PaymentSummarySection({
  projectAmount,
  canViewAmount,
}: {
  projectAmount: number | null
  canViewAmount: boolean
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#1E1B4B]">Payment Summary</h3>
      </div>
      {canViewAmount ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Amount</p>
            <p className="mt-2 text-lg font-bold text-slate-800">{formatCurrency(projectAmount)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Paid</p>
            <p className="mt-2 text-lg font-bold text-slate-800">{formatCurrency(0)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding</p>
            <p className="mt-2 text-lg font-bold text-slate-800">{formatCurrency(projectAmount)}</p>
          </div>
          <p className="text-xs text-slate-500 sm:col-span-3">
            Payment tracking details will populate here once payments are recorded.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          Payment summary is visible only to admins and managers.
        </div>
      )}
    </div>
  )
}

export function ProjectDetailView({
  project: initialProject,
  initialFollowUps = [],
  initialTab,
  canManageProject,
  canManageFollowUps,
  canViewAmount,
  userRole,
  currentUserId,
  clients,
  clientsError,
  technologyTools,
  technologyToolsError,
  teamMembers,
  teamMembersError,
  initialClientsLoaded = false,
  initialTechnologyToolsLoaded = false,
  initialTeamMembersLoaded = false,
}: ProjectDetailViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { success: showSuccess, error: showError } = useToast()
  /** Requirements and Payments tabs are hidden from Staff and Clients */
  const showRequirementsAndPayments = userRole !== 'staff' && userRole !== 'client'
  const initialResolvedTab = resolveProjectDetailTab(parseProjectDetailTab(initialTab), showRequirementsAndPayments)
  const [project, setProject] = useState<Project>(initialProject)
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>(initialResolvedTab)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [linksModalOpen, setLinksModalOpen] = useState(false)
  const [editWebsiteLinks, setEditWebsiteLinks] = useState('')
  const [editReferenceLinks, setEditReferenceLinks] = useState('')
  const [linksUpdating, setLinksUpdating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mobileFollowUpsOpen, setMobileFollowUpsOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [myWorkStatusUpdating, setMyWorkStatusUpdating] = useState(false)
  const [endWorkModalOpen, setEndWorkModalOpen] = useState(false)
  const [endWorkNotes, setEndWorkNotes] = useState('')
  /** Optimistic work state so the timer shows immediately on Start without waiting for server */
  const [optimisticWork, setOptimisticWork] = useState<{ status: 'start'; runningSince: string } | null>(null)
  const [clientOptions, setClientOptions] = useState<ClientSelectOption[]>(clients)
  const [clientOptionsError, setClientOptionsError] = useState<string | null>(clientsError)
  const [clientOptionsLoaded, setClientOptionsLoaded] = useState(initialClientsLoaded)
  const [technologyToolOptions, setTechnologyToolOptions] = useState<TechnologyTool[]>(technologyTools)
  const [technologyToolOptionsError, setTechnologyToolOptionsError] = useState<string | null>(technologyToolsError)
  const [technologyToolOptionsLoaded, setTechnologyToolOptionsLoaded] = useState(initialTechnologyToolsLoaded)
  const [taskAssigneeOptions, setTaskAssigneeOptions] = useState<StaffSelectOption[]>(teamMembers)
  const [taskAssigneeOptionsError, setTaskAssigneeOptionsError] = useState<string | null>(teamMembersError)
  const [taskAssigneeOptionsLoaded, setTaskAssigneeOptionsLoaded] = useState(initialTeamMembersLoaded)
  const [editDependenciesLoading, setEditDependenciesLoading] = useState(false)
  const clientOptionsLoadPromiseRef = useRef<Promise<void> | null>(null)
  const technologyToolOptionsLoadPromiseRef = useRef<Promise<void> | null>(null)
  const taskAssigneeOptionsLoadPromiseRef = useRef<Promise<void> | null>(null)
  const detailsSupplementLoadedRef = useRef(false)

  const visibleTabs = showRequirementsAndPayments
    ? PROJECT_DETAIL_TABS
    : PROJECT_DETAIL_TABS.filter((t) => t.id !== 'requirements' && t.id !== 'payments')
  const [activeDetailsPanelTab, setActiveDetailsPanelTab] = useState<RightPanelTab>(() =>
    resolveRightPanelTab(parseRightPanelTab(searchParams.get(DETAILS_PANEL_QUERY_PARAM)), userRole)
  )

  const updateTabInUrl = useCallback((tab: ProjectDetailTab) => {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : searchParams.toString()
    )
    params.set('tab', tab)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const updateDetailsPanelTabInUrl = useCallback((panelTab: RightPanelTab) => {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : searchParams.toString()
    )
    params.set(DETAILS_PANEL_QUERY_PARAM, panelTab)
    const query = params.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname

    // Update URL without triggering an App Router navigation for faster tab switching.
    if (typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', nextUrl)
      return
    }

    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

  /** Refresh server data while keeping current main tab and (if on Details) details panel tab in the URL so they are preserved. */
  const refreshPreservingTab = useCallback(() => {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : searchParams.toString()
    )
    params.set('tab', activeTab)
    if (activeTab === 'details') {
      params.set(DETAILS_PANEL_QUERY_PARAM, activeDetailsPanelTab)
    }
    const query = params.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname
    router.replace(nextUrl, { scroll: false })
    router.refresh()
  }, [pathname, router, searchParams, activeTab, activeDetailsPanelTab])

  useEffect(() => {
    setProject(initialProject)
    detailsSupplementLoadedRef.current = false
  }, [initialProject])

  const ensureClientOptionsLoaded = useCallback(async () => {
    if (clientOptionsLoaded) return
    if (clientOptionsLoadPromiseRef.current) {
      await clientOptionsLoadPromiseRef.current
      return
    }

    const promise = (async () => {
      const result = await getClientsForSelect()
      setClientOptions(result.data)
      setClientOptionsError(result.error)
      setClientOptionsLoaded(true)
    })().finally(() => {
      clientOptionsLoadPromiseRef.current = null
    })

    clientOptionsLoadPromiseRef.current = promise
    await promise
  }, [clientOptionsLoaded])

  const ensureTechnologyToolOptionsLoaded = useCallback(async () => {
    if (technologyToolOptionsLoaded) return
    if (technologyToolOptionsLoadPromiseRef.current) {
      await technologyToolOptionsLoadPromiseRef.current
      return
    }

    const promise = (async () => {
      const result = await getTechnologyTools()
      setTechnologyToolOptions(result.data)
      setTechnologyToolOptionsError(result.error)
      setTechnologyToolOptionsLoaded(true)
    })().finally(() => {
      technologyToolOptionsLoadPromiseRef.current = null
    })

    technologyToolOptionsLoadPromiseRef.current = promise
    await promise
  }, [technologyToolOptionsLoaded])

  const ensureTaskAssigneeOptionsLoaded = useCallback(async () => {
    if (taskAssigneeOptionsLoaded) return
    if (taskAssigneeOptionsLoadPromiseRef.current) {
      await taskAssigneeOptionsLoadPromiseRef.current
      return
    }

    const promise = (async () => {
      const result = await getStaffForSelect()
      setTaskAssigneeOptions(result.data)
      setTaskAssigneeOptionsError(result.error)
      setTaskAssigneeOptionsLoaded(true)
    })().finally(() => {
      taskAssigneeOptionsLoadPromiseRef.current = null
    })

    taskAssigneeOptionsLoadPromiseRef.current = promise
    await promise
  }, [taskAssigneeOptionsLoaded])

  const ensureEditDependenciesLoaded = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    if (clientOptionsLoaded && technologyToolOptionsLoaded && taskAssigneeOptionsLoaded) return

    if (!silent) {
      setEditDependenciesLoading(true)
    }

    try {
      await Promise.all([
        ensureClientOptionsLoaded(),
        ensureTechnologyToolOptionsLoaded(),
        ensureTaskAssigneeOptionsLoaded(),
      ])
    } finally {
      if (!silent) {
        setEditDependenciesLoading(false)
      }
    }
  }, [
    clientOptionsLoaded,
    technologyToolOptionsLoaded,
    taskAssigneeOptionsLoaded,
    ensureClientOptionsLoaded,
    ensureTechnologyToolOptionsLoaded,
    ensureTaskAssigneeOptionsLoaded,
  ])

  useEffect(() => {
    if (activeTab !== 'tasks') return
    if (taskAssigneeOptionsLoaded) return
    void ensureTaskAssigneeOptionsLoaded()
  }, [activeTab, taskAssigneeOptionsLoaded, ensureTaskAssigneeOptionsLoaded])

  useEffect(() => {
    if (activeTab !== 'details') return
    if (!canManageProject) return
    void ensureEditDependenciesLoaded({ silent: true })
  }, [activeTab, canManageProject, ensureEditDependenciesLoaded])

  /** Load team work stats (work_day_breakdown, etc.) when switching to Details tab if not yet loaded. */
  useEffect(() => {
    if (activeTab !== 'details') return
    if (project.team_members?.length === 0) return
    const needsSupplement = project.team_members?.[0]?.work_day_breakdown === undefined
    if (!needsSupplement || detailsSupplementLoadedRef.current) return

    detailsSupplementLoadedRef.current = true
    getProjectDetailsSupplement(project.id).then((result) => {
      if (result.error || !result.data) return
      setProject((prev) => ({
        ...prev,
        team_members: result.data!.team_members,
        team_member_time_events: result.data!.team_member_time_events,
      }))
    })
  }, [activeTab, project.id, project.team_members])

  /** Keep tab in sync with URL (handles refresh/back-forward/manual query edits). */
  useEffect(() => {
    const nextTab = resolveProjectDetailTab(
      parseProjectDetailTab(searchParams.get('tab')),
      showRequirementsAndPayments
    )
    setActiveTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab))
  }, [searchParams, showRequirementsAndPayments])

  useEffect(() => {
    if (activeTab !== 'details') {
      setMobileFollowUpsOpen(false)
    }
  }, [activeTab])

  /**
   * Keep Details right-panel tab in sync with URL so refresh/back-forward
   * preserve Follow-ups / Work history / Analytics / My notes / Team talk selection.
   */
  useEffect(() => {
    if (activeTab !== 'details') return

    const rawPanelTab = searchParams.get(DETAILS_PANEL_QUERY_PARAM)
    const parsedPanelTab = parseRightPanelTab(rawPanelTab)
    const resolvedPanelTab = resolveRightPanelTab(parsedPanelTab, userRole)
    setActiveDetailsPanelTab((currentTab) => (currentTab === resolvedPanelTab ? currentTab : resolvedPanelTab))

    if (!parsedPanelTab || parsedPanelTab !== resolvedPanelTab || rawPanelTab !== resolvedPanelTab) {
      updateDetailsPanelTabInUrl(resolvedPanelTab)
    }
  }, [activeTab, searchParams, userRole, updateDetailsPanelTabInUrl])

  /** If current URL tab is invalid or hidden for this role, normalize it to Tasks. */
  useEffect(() => {
    const rawTabParam = searchParams.get('tab')
    if (!rawTabParam) return

    const parsedTabParam = parseProjectDetailTab(rawTabParam)
    const resolvedTab = resolveProjectDetailTab(parsedTabParam, showRequirementsAndPayments)
    if (!parsedTabParam || parsedTabParam !== resolvedTab) {
      updateTabInUrl(resolvedTab)
    }
  }, [searchParams, showRequirementsAndPayments, updateTabInUrl])

  const handleTabChange = (nextTab: ProjectDetailTab) => {
    if (nextTab === activeTab) return
    setActiveTab(nextTab)
    updateTabInUrl(nextTab)
  }

  const handleDetailsPanelTabChange = (nextPanelTab: RightPanelTab) => {
    if (nextPanelTab === activeDetailsPanelTab) return
    setActiveDetailsPanelTab(nextPanelTab)
    updateDetailsPanelTabInUrl(nextPanelTab)
  }

  const handleMyWorkStatus = async (eventType: 'start' | 'hold' | 'resume' | 'end', note?: string) => {
    if (!currentUserId || myWorkStatusUpdating) return
    if (eventType === 'start') {
      setOptimisticWork({ status: 'start', runningSince: new Date().toISOString() })
    }
    setMyWorkStatusUpdating(true)
    const result = await updateMyProjectWorkStatus(project.id, eventType, note || undefined)
    setMyWorkStatusUpdating(false)
    setOptimisticWork(null)
    setEndWorkModalOpen(false)
    setEndWorkNotes('')
    if (!result.error && result.data) {
      setProject((prev) => ({
        ...prev,
        team_members: result.data!.team_members,
        team_member_time_events: result.data!.team_member_time_events,
      }))
      showSuccess('Work Status Updated', eventType === 'end' ? 'Work ended and notes saved.' : 'Status updated.')
    } else {
      showError('Update Failed', result.error || 'Failed to update work status')
    }
  }

  const canEdit = canManageProject
  const canDelete = canManageProject
  const canEditClientStatus = userRole === 'admin' || userRole === 'manager'
  const canEditLinks = userRole === 'admin' || userRole === 'manager'
  const canViewTeamMembers = userRole === 'admin' || userRole === 'manager'

  const openLinksModal = () => {
    setEditWebsiteLinks(project.website_links?.split(',').map((s) => s.trim()).filter(Boolean).join('\n') ?? '')
    setEditReferenceLinks(project.reference_links?.split(',').map((s) => s.trim()).filter(Boolean).join('\n') ?? '')
    setLinksModalOpen(true)
  }

  const linksToStored = (text: string) =>
    text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ') || null

  const handleSaveLinks = async () => {
    setLinksUpdating(true)
    const result = await updateProjectLinks(project.id, {
      website_links: linksToStored(editWebsiteLinks),
      reference_links: linksToStored(editReferenceLinks),
    })
    setLinksUpdating(false)
    if (!result.error) {
      setProject((prev) => ({
        ...prev,
        website_links: linksToStored(editWebsiteLinks),
        reference_links: linksToStored(editReferenceLinks),
      }))
      setLinksModalOpen(false)
      showSuccess('Links updated', 'Website and reference links have been saved.')
      refreshPreservingTab()
    } else {
      showError('Update failed', result.error)
    }
  }

  const handleEditSuccess = (updatedProject: Project) => {
    setProject(updatedProject)
    setEditModalOpen(false)
  }

  const handleDelete = () => {
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    const result = await deleteProject(project.id)
    setDeleting(false)

    if (!result.error) {
      router.push('/dashboard/projects')
    } else {
      showError('Delete Failed', result.error || 'Failed to delete project')
      setDeleteModalOpen(false)
    }
  }

  const handleCloseDelete = () => {
    setDeleteModalOpen(false)
  }

  const handleClientStatusChange = async (nextStatus: ProjectStatus) => {
    if (nextStatus === project.status || statusUpdating) return
    setStatusUpdating(true)
    const result = await updateProjectStatus(project.id, nextStatus)
    setStatusUpdating(false)

    if (!result.error && result.data) {
      setProject(result.data)
      showSuccess('Status Updated', 'Client status has been updated.')
      refreshPreservingTab()
    } else {
      showError('Update Failed', result.error || 'Failed to update client status')
    }
  }

  const getInitialEditData = (): ProjectFormData => {
    return {
      name: project.name,
      logo_url: project.logo_url || undefined,
      client_id: project.client_id,
      project_amount: project.project_amount ?? undefined,
      priority: project.priority ?? 'medium',
      client_deadline_date: project.client_deadline_date ?? undefined,
      website_links: project.website_links ?? undefined,
      reference_links: project.reference_links ?? undefined,
      technology_tool_ids: project.technology_tools?.map((tool) => tool.id) ?? [],
      team_member_ids: project.team_members?.map((member) => member.id) ?? [],
    }
  }

  const handleEdit = async () => {
    if (!canEdit) {
      showError('Read-only Access', 'You do not have permission to edit projects.')
      return
    }
    if (editDependenciesLoading) return
    await ensureEditDependenciesLoaded()
    setEditModalOpen(true)
  }

  const clientLabel = project.client
    ? project.client.company_name
      ? `${project.client.name} (${project.client.company_name})`
      : project.client.name
    : '--'

  const websiteLinks = parseLinks(project.website_links)
  const referenceLinks = parseLinks(project.reference_links)

  const staffMember = currentUserId
    ? project.team_members?.find((m) => m.id === currentUserId)
    : null
  const staffWorkState = staffMember
    ? {
      status: (optimisticWork?.status ?? staffMember.work_status ?? 'not_started') as 'not_started' | 'start' | 'hold' | 'end',
      runningSince: optimisticWork?.status === 'start' ? optimisticWork.runningSince : (staffMember.work_running_since ?? null),
      totalSeconds: optimisticWork?.status === 'start' ? 0 : (staffMember.total_work_seconds ?? 0),
      isUpdating: myWorkStatusUpdating,
    }
    : null

  return (
    <>
      <div className="flex h-full flex-col gap-2 sm:gap-3">
        <div className="flex-shrink-0 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex items-stretch overflow-x-auto scrollbar-hide" role="tablist" aria-label="Project detail tabs">
              {visibleTabs.map(({ id, label }, index) => {
                const isActive = activeTab === id
                const isLast = index === visibleTabs.length - 1
                return (
                  <div key={id} className="flex items-stretch">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
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
            {staffWorkState && (
              <ProjectWorkStatusBar
                workState={staffWorkState}
                onWorkStatus={handleMyWorkStatus}
                onOpenEndModal={() => setEndWorkModalOpen(true)}
                className="flex-shrink-0 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0"
              />
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {activeTab === 'details' && (
            <div className="flex h-full flex-col gap-3 overflow-y-auto lg:flex-row lg:overflow-hidden">
              {/* LEFT COLUMN: Project Details */}
              <div className="w-full lg:w-2/5 flex flex-col gap-3 pb-24 scrollbar-hide lg:overflow-y-auto lg:pb-0">
                <div className="rounded-2xl bg-white shadow-sm border border-slate-200 relative">
                  <div className="px-4 pt-4 pb-2 border-b border-slate-100">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Project Details</h2>
                  </div>
                  <div className="relative rounded-t-2xl border-b border-gray-100 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3 sm:gap-5">
                        {project.logo_url ? (
                          <Image
                            src={project.logo_url}
                            alt={project.name}
                            width={80}
                            height={80}
                            className="h-20 w-20 rounded-2xl object-cover shadow-xl ring-2 ring-white"
                          />
                        ) : (
                          <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                            <span className="text-3xl font-extrabold text-white drop-shadow-sm">
                              {getInitials(project.name)}
                            </span>
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h1 className="mb-3 truncate text-xl font-extrabold text-[#1E1B4B] sm:text-2xl" title={project.name}>{project.name}</h1>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 sm:gap-x-6 sm:gap-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                              {canEditClientStatus ? (
                                <StatusSegment
                                  status={project.status}
                                  onStatusChange={handleClientStatusChange}
                                  disabled={statusUpdating}
                                />
                              ) : (
                                <StatusPill status={project.status} />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Priority</span>
                              <PriorityPill priority={project.priority} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 self-end sm:self-auto">
                        {canEdit && (
                          <Tooltip content="Edit project">
                            <button
                              type="button"
                              onClick={handleEdit}
                              disabled={editDependenciesLoading}
                              className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Edit project"
                            >
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip content="Delete project">
                            <button
                              type="button"
                              onClick={handleDelete}
                              className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:ring-offset-1 cursor-pointer"
                              aria-label="Delete project"
                            >
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/30 p-4 space-y-3">
                    {userRole !== 'staff' && (
                      project.client?.id ? (
                        <Link
                          href={`/dashboard/clients/${project.client.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/30 transition-colors cursor-pointer group w-full shadow-sm"
                        >
                          <div className="h-12 w-12 rounded-xl bg-cyan-50 flex items-center justify-center group-hover:bg-cyan-200 group-hover:scale-105 transition-all duration-200">
                            <svg className="h-6 w-6 text-cyan-600 group-hover:text-cyan-700 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</p>
                            <p className="text-sm font-semibold text-slate-700 group-hover:text-cyan-700 line-clamp-2">{clientLabel}</p>
                          </div>
                          <div className="text-slate-300 group-hover:text-cyan-400 transition-colors">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 w-full shadow-sm">
                          <div className="h-12 w-12 rounded-xl bg-cyan-50 flex items-center justify-center">
                            <svg className="h-6 w-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</p>
                            <p className="text-sm font-semibold text-slate-700 line-clamp-2">{clientLabel}</p>
                          </div>
                        </div>
                      )
                    )}

                    <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                      <div className="bg-slate-50/50 px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Timeline</p>
                        <svg className="h-3 w-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {(userRole === 'staff' || userRole === 'admin' || userRole === 'manager') && (
                          <div className="flex items-center justify-between gap-4 py-1.5 px-3 hover:bg-slate-50/50 transition-colors group">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 flex-shrink-0 rounded-lg bg-cyan-50 flex items-center justify-center group-hover:bg-cyan-100 transition-colors">
                                <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-tight">Staff Deadline</p>
                            </div>
                            <p className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              {(() => {
                                const approx = calculateStaffApproxDeadline(project.created_at, project.client_deadline_date)
                                return approx ? formatDate(approx) : '--'
                              })()}
                            </p>
                          </div>
                        )}

                        {userRole !== 'staff' && (
                          <div className="flex items-center justify-between gap-4 py-1.5 px-3 hover:bg-slate-50/50 transition-colors group">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 flex-shrink-0 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                                <svg className="h-3.5 w-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-tight">Client Deadline</p>
                            </div>
                            <p className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              {project.client_deadline_date ? formatDate(project.client_deadline_date) : '--'}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-4 py-1.5 px-3 hover:bg-slate-50/50 transition-colors group">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 flex-shrink-0 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                              <svg className="h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-tight">Created On</p>
                          </div>
                          <p className="text-xs font-bold text-slate-700 whitespace-nowrap">{formatDate(project.created_at)}</p>
                        </div>
                      </div>
                    </div>


                  </div>

                </div>

                {canViewTeamMembers && (
                  <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-[#1E1B4B]">Team Members</h3>
                    </div>
                    {project.team_members && project.team_members.length > 0 ? (
                      <div className="space-y-4">
                        {project.team_members.map((member: ProjectTeamMember) => {
                          const status = member.work_status ?? 'not_started'
                          const todayWorkSeconds = getMemberTodayWorkSeconds(member)
                          const statusStyles: Record<string, string> = {
                            not_started: 'bg-slate-100 text-slate-600 border-slate-200',
                            start: 'bg-cyan-100 text-cyan-800 border-cyan-200',
                            hold: 'bg-amber-100 text-amber-800 border-amber-200',
                            end: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                          }
                          const statusStyle = statusStyles[status] || statusStyles.not_started
                          return (
                            <div
                              key={member.id}
                              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-800">
                                    {member.full_name || member.email || 'Staff Member'}
                                  </span>
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyle}`}>
                                    {formatWorkStatus(status)}
                                  </span>
                                </div>
                                <div className="text-sm text-slate-500">
                                  Today Spent:
                                  <span className="ml-2 font-semibold text-slate-700 tabular-nums">
                                    {formatWorkSeconds(todayWorkSeconds)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                        No team members assigned.
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[#1E1B4B]">Technology & Tools</h3>
                  </div>
                  {project.technology_tools && project.technology_tools.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {project.technology_tools.map((tool) => (
                        <span
                          key={tool.id}
                          className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700"
                        >
                          {tool.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No tools selected yet.</p>
                  )}
                </div>

                <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[#1E1B4B]">Website Links</h3>
                    {canEditLinks && (
                      <Tooltip content="Edit website and reference links">
                        <button
                          type="button"
                          onClick={openLinksModal}
                          className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-cyan-50 hover:text-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-1 cursor-pointer"
                          aria-label="Edit links"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  {websiteLinks.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {websiteLinks.map((link, index) => (
                        <a
                          key={`${link}-${index}`}
                          href={normalizeLink(link)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                        >
                          {link}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No website links added.</p>
                  )}
                </div>

                <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[#1E1B4B]">Reference Site Links</h3>
                    {canEditLinks && (
                      <Tooltip content="Edit website and reference links">
                        <button
                          type="button"
                          onClick={openLinksModal}
                          className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-cyan-50 hover:text-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-1 cursor-pointer"
                          aria-label="Edit links"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  {referenceLinks.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {referenceLinks.map((link, index) => (
                        <a
                          key={`${link}-${index}`}
                          href={normalizeLink(link)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                        >
                          {link}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No reference links added.</p>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Tabs – desktop only (mobile opens this via Updates full-screen) */}
              <div className="hidden w-full lg:w-3/5 lg:flex lg:flex-col lg:gap-3 lg:overflow-y-auto lg:pb-0 scrollbar-hide">
                <ProjectDetailRightPanel
                projectId={project.id}
                initialFollowUps={initialFollowUps}
                canManageFollowUps={canManageFollowUps}
                userRole={userRole}
                currentUserId={currentUserId}
                teamMembers={project.team_members ?? null}
                activeTabOverride={activeDetailsPanelTab}
                  onTabChange={handleDetailsPanelTabChange}
                />
              </div>
            </div>
          )}

          {activeTab === 'requirements' && (
            <ProjectRequirements
              projectId={project.id}
              canWrite={canManageProject}
              canViewAmount={canViewAmount}
              isActiveTab={activeTab === 'requirements'}
              className="h-full"
            />
          )}

          {activeTab === 'payments' && (
            <div className="h-full overflow-y-auto p-0.5">
              <PaymentSummarySection
                projectAmount={project.project_amount}
                canViewAmount={canViewAmount}
              />
            </div>
          )}

          {activeTab === 'tasks' && (
            <ProjectTasks
              projectId={project.id}
              canManageTasks={canManageProject}
              userRole={userRole}
              currentUserId={currentUserId}
              teamMembers={taskAssigneeOptions}
              className="h-full"
            />
          )}
        </div>
      </div>

      {activeTab === 'details' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] safe-area-bottom lg:hidden">
          <div className={`grid gap-3 ${canEdit ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {canEdit && (
              <button
                onClick={handleEdit}
                disabled={editDependenciesLoading}
                className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 text-gray-600 hover:bg-gray-50 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="h-6 w-6 text-[#06B6D4]">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold">Edit</span>
              </button>
            )}

            <button
              onClick={() => setMobileFollowUpsOpen(true)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl bg-[#06B6D4] p-2 text-white shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2"
            >
              <div className="h-6 w-6">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold">Updates</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile updates sheet (Follow-ups, Work history, etc.) */}
      {mobileFollowUpsOpen && activeTab === 'details' && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-gray-900/50 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setMobileFollowUpsOpen(false)} />
          <div className="absolute inset-0 bg-[#F8FAFC] shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-['Poppins',sans-serif] text-lg font-bold text-[#0C4A6E]">Updates</h3>
              <button
                onClick={() => setMobileFollowUpsOpen(false)}
                className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
              <ProjectDetailRightPanel
                projectId={project.id}
                initialFollowUps={initialFollowUps}
                canManageFollowUps={canManageFollowUps}
                userRole={userRole}
                currentUserId={currentUserId}
                teamMembers={project.team_members ?? null}
                className="!rounded-none border-0 h-full"
                activeTabOverride={activeDetailsPanelTab}
                onTabChange={handleDetailsPanelTabChange}
              />
            </div>
          </div>
        </div>
      )}

      {editModalOpen && (
        <ProjectModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          mode="edit"
          initialData={getInitialEditData()}
          onSubmit={async (formData: ProjectFormData) => {
            const result = await updateProject(project.id, formData)
            if (!result.error && result.data) {
              showSuccess('Project Updated', 'Changes have been saved.')
              handleEditSuccess(result.data)
            } else if (result.error) {
              showError('Update Failed', result.error)
            }
            return result
          }}
          clients={clientOptions}
          clientsError={clientOptionsError}
          canViewAmount={canViewAmount}
          technologyTools={technologyToolOptions}
          technologyToolsError={technologyToolOptionsError}
          teamMembers={taskAssigneeOptions}
          teamMembersError={taskAssigneeOptionsError}
        />
      )}

      {/* End Work (Done points) modal – required to fill before ending */}
      {endWorkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-xl">
            <h3 className="text-xl font-bold text-[#1E1B4B] mb-2">End work – Done points</h3>
            <p className="text-sm text-slate-600 mb-4">
              Add a note of what was completed in this session. Required to end work.
            </p>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Done points <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={endWorkNotes}
              onChange={(e) => setEndWorkNotes(e.target.value)}
              placeholder="e.g. Homepage layout, API integration, testing"
              className="mb-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm min-h-[140px] resize-y focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20"
              rows={5}
              required
            />
            <p className="text-xs text-slate-500 mb-4">
              Required. Describe what you completed in this work session before ending.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => { setEndWorkModalOpen(false); setEndWorkNotes('') }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMyWorkStatus('end', endWorkNotes.trim() || undefined)}
                disabled={myWorkStatusUpdating || !endWorkNotes.trim()}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer sm:w-auto"
              >
                {myWorkStatusUpdating ? 'Saving...' : 'End & save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={handleCloseDelete}
          onConfirm={handleConfirmDelete}
          projectName={project.name}
          isLoading={deleting}
        />
      )}

      {linksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-links-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="edit-links-title" className="text-lg font-bold text-[#1E1B4B] mb-4">Edit links</h3>
            <p className="text-xs text-slate-500 mb-3">One link per line or comma-separated.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Website links</label>
                <textarea
                  value={editWebsiteLinks}
                  onChange={(e) => setEditWebsiteLinks(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[80px] resize-y focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reference site links</label>
                <textarea
                  value={editReferenceLinks}
                  onChange={(e) => setEditReferenceLinks(e.target.value)}
                  placeholder="https://reference.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[80px] resize-y focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setLinksModalOpen(false)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLinks}
                disabled={linksUpdating}
                className="w-full rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 cursor-pointer transition-colors sm:w-auto"
              >
                {linksUpdating ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
