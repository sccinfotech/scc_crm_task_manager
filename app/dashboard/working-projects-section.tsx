'use client'

import { useEffect, useState, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateMyProjectWorkStatus } from '@/lib/projects/actions'
import type {
  DashboardWorkingProject,
  DashboardWorkingProjectMember,
  ProjectTeamMemberWorkStatus,
} from '@/lib/projects/actions'
import { useToast } from '@/app/components/ui/toast-context'
import { EndWorkModal } from '@/app/dashboard/projects/end-work-modal'

const WORK_TIMER_TICK_MS = 2000

function formatWorkSecondsHhMmSs(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function WorkStatusPill({ status }: { status: ProjectTeamMemberWorkStatus }) {
  const styles: Record<string, { bg: string; text: string; dot: string; ring: string }> = {
    not_started: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500', ring: 'ring-slate-500/20' },
    start: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-600', ring: 'ring-cyan-600/20' },
    hold: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-600', ring: 'ring-amber-600/20' },
    end: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-600', ring: 'ring-emerald-600/20' },
  }
  const labels: Record<string, string> = {
    not_started: 'Not started',
    start: 'In progress',
    hold: 'On hold',
    end: 'Ended',
  }
  const style = styles[status] ?? styles.not_started
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${style.bg} ${style.text} ring-1 ring-inset ${style.ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {labels[status] ?? status}
    </span>
  )
}

/** Computes current elapsed seconds for display (live when status is 'start'). */
function useLiveWorkSeconds(member: DashboardWorkingProjectMember): number {
  const [now, setNow] = useState(() => Date.now())
  const anchorMs = useRef<number | null>(null)

  useEffect(() => {
    if (member.work_status !== 'start') {
      anchorMs.current = null
      return
    }
    const id = setInterval(() => setNow(Date.now()), WORK_TIMER_TICK_MS)
    return () => clearInterval(id)
  }, [member.work_status])

  if (member.work_status !== 'start' || !member.work_running_since) {
    return member.total_work_seconds
  }
  const runningSinceMs = new Date(member.work_running_since).getTime()
  if (Number.isNaN(runningSinceMs)) return member.total_work_seconds
  if (anchorMs.current === null) anchorMs.current = runningSinceMs
  if (runningSinceMs < anchorMs.current) anchorMs.current = runningSinceMs
  const runningDelta = Math.max(0, (now - anchorMs.current) / 1000)
  return member.total_work_seconds + runningDelta
}

function MemberTimer({ member }: { member: DashboardWorkingProjectMember }) {
  const elapsedSec = useLiveWorkSeconds(member)
  return (
    <span className="font-mono text-sm font-semibold tabular-nums text-slate-800">
      {formatWorkSecondsHhMmSs(elapsedSec)}
    </span>
  )
}

function WorkActionIcon({ action }: { action: 'start' | 'hold' | 'resume' | 'end' }) {
  if (action === 'hold') {
    return (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (action === 'end') {
    return (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 9.5h5v5h-5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function WorkActionButton({
  label,
  tone,
  disabled,
  isLoading,
  onClick,
  icon,
}: {
  label: string
  tone: 'emerald' | 'amber' | 'cyan' | 'slate'
  disabled: boolean
  isLoading: boolean
  onClick: () => void
  icon: ReactNode
}) {
  const toneClasses: Record<'emerald' | 'amber' | 'cyan' | 'slate', string> = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
    cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200',
    slate: 'bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300',
  }
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${toneClasses[tone]}`}
    >
      {isLoading ? (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path className="opacity-90" d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        icon
      )}
    </button>
  )
}

interface WorkingProjectsSectionProps {
  projects: DashboardWorkingProject[]
  isAdmin: boolean
  currentUserId: string
}

export function WorkingProjectsSection({
  projects: initialProjects,
  isAdmin,
  currentUserId,
}: WorkingProjectsSectionProps) {
  const router = useRouter()
  const { success: showToastSuccess, error: showToastError, info: showToastInfo } = useToast()
  const [workActionProjectId, setWorkActionProjectId] = useState<string | null>(null)
  const [endWorkProject, setEndWorkProject] = useState<{ id: string; name: string } | null>(null)

  const handleWorkAction = async (
    projectId: string,
    eventType: 'start' | 'hold' | 'resume' | 'end',
    note?: string
  ) => {
    if (workActionProjectId) return
    setWorkActionProjectId(projectId)
    const result = await updateMyProjectWorkStatus(projectId, eventType, note ?? undefined)
    setWorkActionProjectId(null)
    setEndWorkProject(null)
    if (result.autoEndedSessions.length > 0) {
      showToastInfo(
        'Session auto-ended',
        `Your running Work session was automatically ended at ${result.cutoffLabel} (${result.cutoffTimezone}).`
      )
    }
    if (!result.error) {
      const messages: Record<string, string> = {
        start: 'Work started.',
        hold: 'Work paused.',
        resume: 'Work resumed.',
        end: 'Work ended and notes saved.',
      }
      showToastSuccess('Work updated', messages[eventType] ?? 'Done.')
      router.refresh()
    } else {
      showToastError('Work action failed', result.error)
    }
    return result
  }

  const handleEndWorkSubmit = async (projectId: string, _projectName: string, doneNotes: string) => {
    await handleWorkAction(projectId, 'end', doneNotes)
  }

  const renderWorkActions = (projectId: string, projectName: string, member: DashboardWorkingProjectMember) => {
    const isMyRow = member.user_id === currentUserId
    if (!isMyRow) return <span className="text-xs text-slate-400">—</span>
    const status = member.work_status
    const loading = workActionProjectId === projectId
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {status === 'not_started' && (
          <WorkActionButton
            label="Start"
            tone="emerald"
            disabled={loading}
            isLoading={loading}
            onClick={() => handleWorkAction(projectId, 'start')}
            icon={<WorkActionIcon action="start" />}
          />
        )}
        {status === 'start' && (
          <>
            <WorkActionButton
              label="Hold"
              tone="amber"
              disabled={loading}
              isLoading={loading}
              onClick={() => handleWorkAction(projectId, 'hold')}
              icon={<WorkActionIcon action="hold" />}
            />
            <WorkActionButton
              label="End session"
              tone="slate"
              disabled={loading}
              isLoading={false}
              onClick={() => setEndWorkProject({ id: projectId, name: projectName })}
              icon={<WorkActionIcon action="end" />}
            />
          </>
        )}
        {status === 'hold' && (
          <>
            <WorkActionButton
              label="Resume"
              tone="cyan"
              disabled={loading}
              isLoading={loading}
              onClick={() => handleWorkAction(projectId, 'resume')}
              icon={<WorkActionIcon action="resume" />}
            />
            <WorkActionButton
              label="End session"
              tone="slate"
              disabled={loading}
              isLoading={false}
              onClick={() => setEndWorkProject({ id: projectId, name: projectName })}
              icon={<WorkActionIcon action="end" />}
            />
          </>
        )}
        {status === 'end' && (
          <WorkActionButton
            label="Start again"
            tone="emerald"
            disabled={loading}
            isLoading={loading}
            onClick={() => handleWorkAction(projectId, 'start')}
            icon={<WorkActionIcon action="start" />}
          />
        )}
      </div>
    )
  }

  if (initialProjects.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1E1B4B]">Working projects</h2>
        <p className="mt-2 text-sm text-slate-500">
          {isAdmin
            ? 'No projects currently in progress. Team members appear here when they start work on a project.'
            : 'You have no started projects. Go to Projects and start work on an assigned project to see it here.'}
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <h2 className="text-lg font-semibold text-[#1E1B4B]">
          {isAdmin ? 'Working projects' : 'My started projects'}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {isAdmin
            ? 'Projects with at least one team member currently working (start or on hold).'
            : 'Projects you have started and not yet ended.'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="text-left py-3 px-4 font-medium text-slate-700">Project</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Work status</th>
              {isAdmin && (
                <th className="text-left py-3 px-4 font-medium text-slate-700">Team member</th>
              )}
              <th className="text-left py-3 px-4 font-medium text-slate-700">Total timer</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Work</th>
            </tr>
          </thead>
          <tbody>
            {initialProjects.map((project) =>
              isAdmin ? (
                project.team_members.map((member, idx) => (
                  <tr
                    key={`${project.id}-${member.user_id}`}
                    className="border-b border-slate-100 hover:bg-slate-50/50"
                  >
                    {idx === 0 ? (
                      <td
                        rowSpan={project.team_members.length}
                        className="py-3 px-4 align-top"
                      >
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="font-medium text-cyan-700 hover:text-cyan-800 hover:underline"
                        >
                          {project.name}
                        </Link>
                        {project.client_name && (
                          <div className="text-xs text-slate-500 mt-0.5">{project.client_name}</div>
                        )}
                      </td>
                    ) : null}
                    <td className="py-3 px-4 align-top">
                      <WorkStatusPill status={member.work_status} />
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">
                        {member.full_name || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <MemberTimer member={member} />
                    </td>
                    <td className="py-3 px-4">
                      {renderWorkActions(project.id, project.name, member)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr key={project.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-3 px-4">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="font-medium text-cyan-700 hover:text-cyan-800 hover:underline"
                    >
                      {project.name}
                    </Link>
                    {project.client_name && (
                      <div className="text-xs text-slate-500 mt-0.5">{project.client_name}</div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {project.team_members.length > 0 && (
                      <WorkStatusPill status={project.team_members[0].work_status} />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {project.team_members.length > 0 && (
                      <MemberTimer member={project.team_members[0]} />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {project.team_members.length > 0 &&
                      renderWorkActions(project.id, project.name, project.team_members[0])}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <EndWorkModal
        isOpen={endWorkProject != null}
        onClose={() => setEndWorkProject(null)}
        projectName={endWorkProject?.name ?? ''}
        onSubmit={(doneNotes) =>
          endWorkProject
            ? handleEndWorkSubmit(endWorkProject.id, endWorkProject.name, doneNotes)
            : Promise.resolve()
        }
        isLoading={endWorkProject != null && workActionProjectId === endWorkProject.id}
      />
    </section>
  )
}
