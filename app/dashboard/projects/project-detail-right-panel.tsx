'use client'

import { useState, useRef, useEffect } from 'react'
import { ProjectFollowUps } from './project-followups'
import { ProjectWorkHistory } from './project-work-history'
import { ProjectMyNotes } from './project-my-notes'
import type { ProjectFollowUp } from '@/lib/projects/actions'
import type { ProjectTeamMember } from '@/lib/projects/actions'

export type RightPanelTab = 'follow-ups' | 'work-history' | 'my-notes' | 'team-talk'

interface ProjectDetailRightPanelProps {
  projectId: string
  initialFollowUps: ProjectFollowUp[]
  canManageFollowUps: boolean
  userRole: string
  currentUserId: string | undefined
  teamMembers: ProjectTeamMember[] | null | undefined
  /** Staff only: current user work state and handler for Start/Hold/End (used in Work history bottom) */
  staffWorkState?: {
    status: 'not_started' | 'start' | 'hold' | 'end'
    runningSince: string | null
    totalSeconds: number
    isUpdating: boolean
  } | null
  onStaffWorkStatus?: (eventType: 'start' | 'hold' | 'resume' | 'end', note?: string) => Promise<void>
  className?: string
  hideTabs?: boolean
  activeTabOverride?: RightPanelTab | null
  onTabChange?: (tab: RightPanelTab) => void
}

const ALL_TABS: { id: RightPanelTab; label: string }[] = [
  { id: 'follow-ups', label: 'Follow-ups' },
  { id: 'work-history', label: 'Work history' },
  { id: 'my-notes', label: 'My Notes' },
  { id: 'team-talk', label: 'Team Talk' },
]

const STAFF_TABS: { id: RightPanelTab; label: string }[] = [
  { id: 'work-history', label: 'Work history' },
  { id: 'my-notes', label: 'My Notes' },
  { id: 'team-talk', label: 'Team Talk' },
]

export function ProjectDetailRightPanel({
  projectId,
  initialFollowUps,
  canManageFollowUps,
  userRole,
  currentUserId,
  teamMembers,
  staffWorkState = null,
  onStaffWorkStatus,
  className = '',
  hideTabs = false,
  activeTabOverride = null,
  onTabChange,
}: ProjectDetailRightPanelProps) {
  const isStaff = userRole === 'staff'
  const tabConfig = isStaff ? STAFF_TABS : ALL_TABS
  const defaultTab: RightPanelTab = isStaff ? 'work-history' : 'follow-ups'
  const [activeTab, setActiveTab] = useState<RightPanelTab>(defaultTab)
  const tab = activeTabOverride ?? activeTab
  // Only mount and fetch a tab's data when the user has clicked that tab (per-tab lazy load).
  const visitedTabsRef = useRef<Set<RightPanelTab>>(
    new Set(activeTabOverride ? [defaultTab, activeTabOverride] : [defaultTab])
  )

  useEffect(() => {
    visitedTabsRef.current.add(tab)
  }, [tab])

  const handleTab = (id: RightPanelTab) => {
    visitedTabsRef.current.add(id)
    if (activeTabOverride === null) setActiveTab(id)
    onTabChange?.(id)
  }

  const hasVisited = (id: RightPanelTab) => visitedTabsRef.current.has(id)
  const activeTabLabel = tabConfig.find((t) => t.id === tab)?.label ?? tab
  const showPlaceholder = !hasVisited(tab)

  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      {!hideTabs && (
        <div className="flex-shrink-0 rounded-t-2xl overflow-hidden bg-slate-100/80 p-1.5 border border-slate-200/80">
          <div className="flex gap-1" role="tablist" aria-label="Project detail sections">
            {tabConfig.map(({ id, label }, index) => {
              const isActive = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${id}`}
                  id={`tab-${id}`}
                  onClick={() => handleTab(id)}
                  className={`
                    flex-1 min-w-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 focus:ring-offset-slate-100
                    cursor-pointer
                    ${isActive
                      ? 'bg-white text-[#0C4A6E] shadow-sm border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-white/60 border border-transparent'}
                  `}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden rounded-b-2xl border border-t-0 border-slate-200 bg-white shadow-sm relative">
        {/* Placeholder when no tab opened yet: data loads only when user clicks a tab */}
        {showPlaceholder && (
          <div
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center"
          >
            <p className="text-sm text-slate-500">
              Select a tab above to load its content. Data for each section loads only when you open that tab.
            </p>
            <button
              type="button"
              onClick={() => handleTab(tab)}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
            >
              Load {activeTabLabel}
            </button>
          </div>
        )}
        {/* Lazy-mount tabs on first visit; once mounted, hide with CSS so switching back is instant */}
        {!showPlaceholder && hasVisited('follow-ups') && (
          <div
            id="panel-follow-ups"
            role="tabpanel"
            aria-labelledby="tab-follow-ups"
            aria-hidden={tab !== 'follow-ups'}
            className={`h-full ${tab === 'follow-ups' ? 'block' : 'hidden'}`}
          >
            <ProjectFollowUps
              projectId={projectId}
              initialFollowUps={initialFollowUps}
              canWrite={canManageFollowUps}
              hideHeader={true}
              className="!rounded-none !border-t-0 h-full"
            />
          </div>
        )}
        {!showPlaceholder && hasVisited('work-history') && (
          <div
            id="panel-work-history"
            role="tabpanel"
            aria-labelledby="tab-work-history"
            aria-hidden={tab !== 'work-history'}
            className={`h-full ${tab === 'work-history' ? 'block' : 'hidden'}`}
          >
            <ProjectWorkHistory
              projectId={projectId}
              userRole={userRole}
              currentUserId={currentUserId}
              teamMembers={teamMembers ?? undefined}
              hideHeader={true}
              staffWorkState={isStaff ? staffWorkState ?? null : null}
              onStaffWorkStatus={isStaff ? onStaffWorkStatus : undefined}
              isActiveTab={tab === 'work-history'}
              className="!rounded-none !border-t-0 h-full"
            />
          </div>
        )}
        {!showPlaceholder && hasVisited('my-notes') && (
          <div
            id="panel-my-notes"
            role="tabpanel"
            aria-labelledby="tab-my-notes"
            aria-hidden={tab !== 'my-notes'}
            className={`h-full ${tab === 'my-notes' ? 'block' : 'hidden'}`}
          >
            <ProjectMyNotes
              projectId={projectId}
              userRole={userRole}
              currentUserId={currentUserId}
              hideHeader={true}
              className="!rounded-none !border-t-0 h-full"
            />
          </div>
        )}
        {!showPlaceholder && hasVisited('team-talk') && (
          <div
            id="panel-team-talk"
            role="tabpanel"
            aria-labelledby="tab-team-talk"
            aria-hidden={tab !== 'team-talk'}
            className={`h-full flex flex-col bg-white rounded-b-2xl border border-t-0 border-slate-200 p-4 ${tab === 'team-talk' ? 'block' : 'hidden'}`}
          >
            <p className="text-sm text-slate-500">Team Talk – coming soon.</p>
          </div>
        )}
      </div>
    </div>
  )
}
