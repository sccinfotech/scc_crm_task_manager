'use client'

import { useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/app/components/empty-state'
import type { ClientListItem } from '@/lib/clients/actions'

function StatusPill({ status }: { status: ClientListItem['status'] }) {
  const styles = {
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-600', ring: 'ring-emerald-600/20' },
    inactive: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-600', ring: 'ring-gray-600/20' },
  }
  const labels = { active: 'Active', inactive: 'Inactive' }
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

export interface ClientsCardListProps {
  clients: ClientListItem[]
  canWrite: boolean
  canManageInternalNotes?: boolean
  onView: (clientId: string) => void
  onEdit: (clientId: string) => void
  onDelete: (clientId: string, clientName: string) => void
  onOpenInternalNotes?: (clientId: string, clientName: string) => void
  isFiltered?: boolean
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

export function ClientsCardList({
  clients,
  canWrite,
  canManageInternalNotes = false,
  onEdit,
  onDelete,
  onOpenInternalNotes,
  isFiltered = false,
  hasMore,
  loadingMore,
  onLoadMore,
}: ClientsCardListProps) {
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

  if (clients.length === 0) {
    return (
      <div className="flex min-h-[400px] w-full items-center justify-center bg-white p-4">
        <EmptyState
          variant={isFiltered ? 'search' : 'leads'}
          title={isFiltered ? 'No clients found' : 'No clients yet'}
          description={
            isFiltered ? 'Try adjusting your filters.' : 'Create your first client to get started.'
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 bg-white p-4 pb-8">
      {clients.map((client) => (
        <article
          key={client.id}
          className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2"
        >
          <Link
            href={`/dashboard/clients/${client.id}`}
            prefetch
            className="block no-underline text-inherit outline-none"
          >
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-sm ring-2 ring-white">
                {client.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-gray-900">{client.name}</h3>
                {client.company_name && (
                  <p className="mt-0.5 truncate text-sm text-gray-500">{client.company_name}</p>
                )}
                <p className="mt-1 text-sm font-medium text-gray-600">{client.phone}</p>
                {client.email && (
                  <p className="mt-0.5 truncate text-sm text-gray-500">{client.email}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill status={client.status} />
                  <span className="text-xs text-gray-400">
                    Created {formatDate(client.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </Link>
          <div className="flex items-center justify-end gap-1 border-t border-gray-100 px-4 py-2">
            {canManageInternalNotes && onOpenInternalNotes && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  onOpenInternalNotes(client.id, client.name)
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                aria-label="Internal notes"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 4h8m-8 4h6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H9l-4 4V7a2 2 0 012-2z" />
                </svg>
              </button>
            )}
            {canWrite && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    onEdit(client.id)
                  }}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                  aria-label="Edit client"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    onDelete(client.id, client.name)
                  }}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete client"
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
      <div ref={sentinelRef} className="h-4 w-full" aria-hidden />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <span className="text-sm text-gray-500">Loading more…</span>
        </div>
      )}
    </div>
  )
}
