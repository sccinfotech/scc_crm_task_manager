'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/app/components/empty-state'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import { updateMyProjectWorkStatus } from '@/lib/projects/actions'
import type { ProjectStatus, ProjectTeamMemberWorkStatus } from '@/lib/projects/actions'
import type { ProjectListItem } from '@/lib/projects/actions'
import { EndWorkModal } from './end-work-modal'

function StatusPill({ status }: { status: ProjectStatus }) {
  const styles = {
    pending: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500', ring: 'ring-slate-500/20' },
    in_progress: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-600', ring: 'ring-cyan-600/20' },
    hold: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-600', ring: 'ring-amber-600/20' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-600', ring: 'ring-emerald-600/20' },
  }
  const labels = { pending: 'Pending', in_progress: 'In Progress', hold: 'Hold', completed: 'Completed' }
  const style = styles[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${style.bg} ${style.text} ring-1 ring-inset ${style.ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {labels[status]}
    </span>
  )
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatFollowUpDate(dateString: string | null) {
  if (!dateString) return null
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getFollowUpDateColor(dateString: string | null): string {
  if (!dateString) return 'text-gray-500'
  const followUpDate = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const followUpDateOnly = new Date(followUpDate)
  followUpDateOnly.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((followUpDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'text-red-600 font-semibold'
  if (diffDays <= 7) return 'text-amber-600 font-semibold'
  return 'text-gray-700'
}

function getInitials(name: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function parseWebsiteLinks(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((link) => link.trim()).filter(Boolean)
}

function normalizeLink(url: string) {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

export interface ProjectsCardListProps {
  projects: ProjectListItem[]
  canWrite: boolean
  showClientColumn?: boolean
  showWorkActions?: boolean
  onView: (projectId: string) => void
  onEdit: (projectId: string) => void
  onDelete: (projectId: string, projectName: string) => void
  onWorkUpdated?: () => void
  isFiltered?: boolean
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

export function ProjectsCardList({
  projects,
  canWrite,
  showClientColumn = true,
  showWorkActions = false,
  onEdit,
  onDelete,
  onWorkUpdated,
  isFiltered = false,
  hasMore,
  loadingMore,
  onLoadMore,
}: ProjectsCardListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [endWorkProject, setEndWorkProject] = useState<{ id: string; name: string } | null>(null)
  const [workActionProjectId, setWorkActionProjectId] = useState<string | null>(null)
  const { success: showToastSuccess, error: showToastError } = useToast()

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (!entry?.isIntersecting || loadingMore || !hasMore) return
      onLoadMore()
    },
    [loadingMore, hasMore, onLoadMore]
  )

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin: '200px',
      threshold: 0.1,
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleIntersect])

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
    if (!result.error) {
      const messages: Record<string, string> = {
        start: 'Work started.',
        hold: 'Work paused.',
        resume: 'Work resumed.',
        end: 'Work ended and notes saved.',
      }
      showToastSuccess('Work updated', messages[eventType] ?? 'Done.')
      onWorkUpdated?.()
    } else {
      showToastError('Work action failed', result.error)
    }
    return result
  }

  const handleEndWorkSubmit = async (projectId: string, _projectName: string, doneNotes: string) => {
    await handleWorkAction(projectId, 'end', doneNotes)
  }

  if (projects.length === 0) {
    return (
      <div className="flex min-h-[400px] w-full items-center justify-center bg-white p-4">
        <EmptyState
          variant={isFiltered ? 'search' : 'projects'}
          title={isFiltered ? 'No projects found' : 'No projects yet'}
          description={
            isFiltered ? 'Try adjusting your filters.' : 'Create your first project to get started.'
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 bg-white p-4 pb-8">
      {projects.map((project) => {
        const clientLabel = project.client_name || project.client_company_name || '—'
        const websiteLinks = parseWebsiteLinks(project.website_links)
        const myStatus = project.my_work_status as ProjectTeamMemberWorkStatus | null | undefined

        return (
          <article
            key={project.id}
            className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2"
          >
            <Link
              href={`/dashboard/projects/${project.id}`}
              prefetch
              className="block no-underline text-inherit outline-none"
            >
              <div className="flex items-start gap-3 p-4">
                {project.logo_url ? (
                  <img
                    src={project.logo_url}
                    alt={project.name}
                    className="h-10 w-10 flex-shrink-0 rounded-full object-cover shadow-sm ring-2 ring-white"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-sm ring-2 ring-white">
                    {getInitials(project.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold text-gray-900">{project.name}</h3>
                  {showClientColumn && (
                    <p className="mt-0.5 truncate text-sm text-gray-500">{clientLabel}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill status={project.status} />
                    <span className="text-xs text-gray-500">
                      Start {formatDate(project.start_date)}
                    </span>
                    {project.developer_deadline_date && (
                      <span className="text-xs text-gray-500">
                        Deadline {formatDate(project.developer_deadline_date)}
                      </span>
                    )}
                    {project.follow_up_date && (
                      <span className={`text-xs ${getFollowUpDateColor(project.follow_up_date)}`}>
                        Follow-up {formatFollowUpDate(project.follow_up_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
            {(showWorkActions && myStatus != null) || websiteLinks.length > 0 || canWrite ? (
              <div className="flex flex-wrap items-center justify-end gap-1 border-t border-gray-100 px-4 py-2">
                {showWorkActions && myStatus != null && (
                  <div className="mr-auto flex flex-wrap items-center gap-1.5">
                    {myStatus === 'not_started' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          handleWorkAction(project.id, 'start')
                        }}
                        disabled={workActionProjectId === project.id}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {workActionProjectId === project.id ? '…' : 'Start'}
                      </button>
                    )}
                    {myStatus === 'start' && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            handleWorkAction(project.id, 'hold')
                          }}
                          disabled={workActionProjectId === project.id}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Hold
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            setEndWorkProject({ id: project.id, name: project.name })
                          }}
                          disabled={workActionProjectId === project.id}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          End
                        </button>
                      </>
                    )}
                    {myStatus === 'hold' && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            handleWorkAction(project.id, 'resume')
                          }}
                          disabled={workActionProjectId === project.id}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-cyan-100 text-cyan-800 border border-cyan-200 hover:bg-cyan-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Resume
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            setEndWorkProject({ id: project.id, name: project.name })
                          }}
                          disabled={workActionProjectId === project.id}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          End
                        </button>
                      </>
                    )}
                    {myStatus === 'end' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          handleWorkAction(project.id, 'start')
                        }}
                        disabled={workActionProjectId === project.id}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Start again
                      </button>
                    )}
                  </div>
                )}
                {websiteLinks.map((link, index) => (
                  <Tooltip key={`${link}-${index}`} content={link} position="left">
                    <a
                      href={normalizeLink(link)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                      aria-label="Open link"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0L6 12.343a4 4 0 105.657 5.657l1.414-1.414" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0L18 11.657a4 4 0 10-5.657-5.657l-1.414 1.414" />
                      </svg>
                    </a>
                  </Tooltip>
                ))}
                {canWrite && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        onEdit(project.id)
                      }}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                      aria-label="Edit project"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        onDelete(project.id, project.name)
                      }}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete project"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </article>
        )
      })}
      <div ref={sentinelRef} className="h-4 w-full" aria-hidden />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <span className="text-sm text-gray-500">Loading more…</span>
        </div>
      )}

      <EndWorkModal
        isOpen={endWorkProject != null}
        onClose={() => setEndWorkProject(null)}
        projectName={endWorkProject?.name ?? ''}
        onSubmit={(doneNotes) =>
          endWorkProject
            ? handleEndWorkSubmit(endWorkProject.id, endWorkProject.name, doneNotes)
            : Promise.resolve()
        }
        isLoading={endWorkProject != null && workActionProjectId === endWorkProject?.id}
      />
    </div>
  )
}
