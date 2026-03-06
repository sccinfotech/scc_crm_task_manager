'use client'

import { useEffect, useState, useRef, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateMyProjectWorkStatus } from '@/lib/projects/actions'
import type {
  DashboardWorkingProject,
  DashboardWorkingProjectMember,
  ProjectTeamMemberWorkStatus,
} from '@/lib/projects/actions'
import { useToast } from '@/app/components/ui/toast-context'
import { StaffAvatar } from '@/app/components/ui/staff-avatar'
import { EndWorkModal } from '@/app/dashboard/projects/end-work-modal'

const WORK_TIMER_TICK_MS = 2000

function getProjectInitials(name: string): string {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function ProjectNameWithIcon({
  name,
  logoUrl,
  href,
}: { name: string; logoUrl: string | null; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2.5 min-w-0 font-medium text-cyan-700 hover:text-cyan-800 hover:underline"
    >
      {logoUrl ? (
        <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200/80 shadow-sm">
          <Image
            src={logoUrl}
            alt=""
            fill
            className="object-contain p-0.5"
            sizes="32px"
          />
        </span>
      ) : (
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white shadow-sm ring-2 ring-white"
          aria-hidden
        >
          {getProjectInitials(name)}
        </span>
      )}
      <span className="block max-w-[10rem] break-words leading-5 line-clamp-2 sm:max-w-[14rem] lg:max-w-[18rem]">
        {name}
      </span>
    </Link>
  )
}

function formatWorkSecondsHhMmSs(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)} : ${pad(m)} : ${pad(s)}`
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

/** Total Timer: digital font, red, slightly bigger */
function MemberTimer({ member }: { member: DashboardWorkingProjectMember }) {
  const elapsedSec = useLiveWorkSeconds(member)
  return (
    <span className="inline-block whitespace-nowrap font-digital text-base font-semibold tabular-nums tracking-[0.08em] text-red-600">
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
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden h-full flex flex-col min-h-0">
      <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-3 sm:px-4 flex-shrink-0">
        <h2 className="text-base font-semibold text-[#1E1B4B] sm:text-lg">
          {isAdmin ? 'Working projects' : 'My started projects'}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {isAdmin
            ? 'Projects with at least one team member currently working (start or on hold).'
            : 'Projects you have started and not yet ended.'}
        </p>
      </div>
      <div className="overflow-x-auto -mx-px sm:mx-0 flex-1 min-h-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="text-left py-3 px-3 sm:px-4 font-medium text-slate-700">Project</th>
              <th className="text-left py-3 px-3 sm:px-4 font-medium text-slate-700 whitespace-nowrap">Team member</th>
              <th className="text-left py-3 px-3 sm:px-4 font-medium text-slate-700 whitespace-nowrap">Total timer</th>
              <th className="text-left py-3 px-3 sm:px-4 font-medium text-slate-700">Work</th>
            </tr>
          </thead>
          <tbody>
            {initialProjects.map((project) =>
              isAdmin ? (
                project.team_members.map((member, idx) => (
                  <tr
                    key={`${project.id}-${member.user_id}`}
                    className={`border-b border-slate-100 transition-colors ${
                      member.work_status === 'hold'
                        ? 'bg-amber-50/70 hover:bg-amber-100/80'
                        : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {idx === 0 ? (
                      <td
                        rowSpan={project.team_members.length}
                        className="py-3 px-3 sm:px-4 align-middle"
                      >
                        <ProjectNameWithIcon
                          name={project.name}
                          logoUrl={project.logo_url}
                          href={`/dashboard/projects/${project.id}`}
                        />
                      </td>
                    ) : null}
                    <td className="py-3 px-3 sm:px-4">
                      <div className="flex items-center gap-2">
                        <StaffAvatar
                          photoUrl={member.photo_url}
                          fullName={member.full_name}
                          size="md"
                          className="shrink-0"
                        />
                        <span className="font-medium text-slate-800">
                          {member.full_name || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <MemberTimer member={member} />
                    </td>
                    <td className="py-3 px-3 sm:px-4">
                      {renderWorkActions(project.id, project.name, member)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr
                  key={project.id}
                  className={`border-b border-slate-100 transition-colors ${
                    project.team_members[0]?.work_status === 'hold'
                      ? 'bg-amber-50/70 hover:bg-amber-100/80'
                      : 'hover:bg-slate-50/50'
                  }`}
                >
                  <td className="py-3 px-3 sm:px-4 align-middle">
                    <ProjectNameWithIcon
                      name={project.name}
                      logoUrl={project.logo_url}
                      href={`/dashboard/projects/${project.id}`}
                    />
                  </td>
                  <td className="py-3 px-3 sm:px-4">
                    <div className="flex items-center gap-2">
                      {project.team_members[0] && (
                        <StaffAvatar
                          photoUrl={project.team_members[0].photo_url}
                          fullName={project.team_members[0].full_name}
                          size="md"
                          className="shrink-0"
                        />
                      )}
                      <span className="font-medium text-slate-800">
                        {project.team_members[0]?.full_name || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                    {project.team_members.length > 0 && (
                      <MemberTimer member={project.team_members[0]} />
                    )}
                  </td>
                  <td className="py-3 px-3 sm:px-4">
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
