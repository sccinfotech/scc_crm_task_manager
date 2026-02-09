'use client'

import { useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/app/components/empty-state'
import type { LeadListItem } from '@/lib/leads/actions'

function StatusPill({ status }: { status: LeadListItem['status'] }) {
  const styles = {
    new: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-600', ring: 'ring-blue-600/20' },
    contacted: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-600', ring: 'ring-purple-600/20' },
    follow_up: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-600', ring: 'ring-orange-600/20' },
    converted: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-600', ring: 'ring-green-600/20' },
    lost: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-600', ring: 'ring-red-600/20' },
  }
  const labels = {
    new: 'New',
    contacted: 'Contacted',
    follow_up: 'Follow Up',
    converted: 'Converted',
    lost: 'Lost',
  }
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
  if (diffDays <= 0) return 'text-rose-600 font-semibold'
  if (diffDays <= 7) return 'text-amber-600 font-medium'
  return 'text-gray-900 font-medium'
}

export interface LeadsCardListProps {
  leads: LeadListItem[]
  canWrite: boolean
  onView: (leadId: string) => void
  onEdit: (leadId: string) => void
  onDelete: (leadId: string, leadName: string) => void
  onConvert?: (leadId: string) => void
  canConvert?: boolean
  isFiltered?: boolean
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

export function LeadsCardList({
  leads,
  canWrite,
  onEdit,
  onDelete,
  onConvert,
  canConvert = false,
  isFiltered = false,
  hasMore,
  loadingMore,
  onLoadMore,
}: LeadsCardListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

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

  if (leads.length === 0) {
    return (
      <div className="flex min-h-[400px] w-full items-center justify-center bg-white p-4">
        <EmptyState
          variant={isFiltered ? 'search' : 'leads'}
          title={isFiltered ? 'No leads found' : 'No leads yet'}
          description={
            isFiltered ? 'Try adjusting your filters.' : 'Create your first lead to get started.'
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 bg-white p-4 pb-8">
      {leads.map((lead) => (
        <article
          key={lead.id}
          className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2"
        >
          <Link
            href={`/dashboard/leads/${lead.id}`}
            prefetch
            className="block no-underline text-inherit outline-none"
          >
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-sm ring-2 ring-white">
                {lead.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-gray-900">{lead.name}</h3>
                {lead.company_name && (
                  <p className="mt-0.5 truncate text-sm text-gray-500">{lead.company_name}</p>
                )}
                <p className="mt-1 text-sm font-medium text-gray-600">{lead.phone}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill status={lead.status} />
                  {lead.follow_up_date && (
                    <span className={`text-xs ${getFollowUpDateColor(lead.follow_up_date)}`}>
                      Follow-up: {formatFollowUpDate(lead.follow_up_date)}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    Created {formatDate(lead.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </Link>
          <div className="flex items-center justify-end gap-1 border-t border-gray-100 px-4 py-2">
            {canConvert && onConvert && lead.status !== 'converted' && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  onConvert(lead.id)
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                aria-label="Convert to client"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
            {canWrite && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    onEdit(lead.id)
                  }}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                  aria-label="Edit lead"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    onDelete(lead.id, lead.name)
                  }}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete lead"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </article>
      ))}
      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-4 w-full" aria-hidden />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <span className="text-sm text-gray-500">Loading more…</span>
        </div>
      )}
    </div>
  )
}
