'use client'

import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { SidebarToggleButton } from '@/app/components/dashboard/sidebar-context'
import { Tooltip } from '@/app/components/ui/tooltip'
import { EmptyState } from '@/app/components/empty-state'
import { SearchInput } from '@/app/components/ui/search-input'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import { AddPaymentModal } from './add-payment-modal'
import type { PaymentProjectListItem } from '@/lib/payments/actions'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

const STATUS_OPTIONS: { value: 'all' | 'pending' | 'paid'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending only' },
  { value: 'paid', label: 'Fully paid' },
]

interface PaymentsClientProps {
  projects: PaymentProjectListItem[]
  initialSearch: string
  initialStatus: 'all' | 'pending' | 'paid'
}

export function PaymentsClient({ projects, initialSearch, initialStatus }: PaymentsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [paymentModalProject, setPaymentModalProject] = useState<PaymentProjectListItem | null>(null)
  const [search, setSearch] = useState(initialSearch)
  const [status, setStatus] = useState<'all' | 'pending' | 'paid'>(initialStatus)

  const updateFilters = useCallback(
    (updates: { search?: string; status?: 'all' | 'pending' | 'paid' }) => {
      const params = new URLSearchParams(searchParams.toString())
      const nextSearch = updates.search !== undefined ? updates.search : search
      const nextStatus = updates.status !== undefined ? updates.status : status

      if (nextSearch) params.set('search', nextSearch)
      else params.delete('search')

      if (nextStatus && nextStatus !== 'all') params.set('status', nextStatus)
      else params.delete('status')

      params.delete('page')
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, searchParams, search, status]
  )

  const handleSearchChange = (value: string) => {
    setSearch(value)
    updateFilters({ search: value })
  }

  const handleStatusChange = (value: string) => {
    const next = (value === 'pending' || value === 'paid') ? value : 'all'
    setStatus(next)
    updateFilters({ status: next })
  }

  const handleRowClick = useCallback(
    (projectId: string) => {
      router.push(`/dashboard/payments/${projectId}`)
    },
    [router]
  )

  const handlePayNow = (e: React.MouseEvent, project: PaymentProjectListItem) => {
    e.stopPropagation()
    setPaymentModalProject(project)
  }

  const handlePaymentSuccess = useCallback(() => {
    router.refresh()
  }, [router])

  const renderContent = () => {
    if (projects.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            title="No projects with requirements"
            description="Projects that have at least one requirement (from the Requirements tab) will appear here for payment tracking."
          />
        </div>
      )
    }

    return (
      <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Project</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Client</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Total Amount</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Pending</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Received</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {projects.map((row) => (
              <tr
                key={row.id}
                onClick={() => handleRowClick(row.id)}
              >
                <td className="whitespace-nowrap px-3 sm:px-4 py-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {row.logo_url ? (
                      <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200/80 shadow-sm sm:h-9 sm:w-9">
                        <Image
                          src={row.logo_url}
                          alt={row.name}
                          fill
                          className="object-contain p-0.5"
                          sizes="36px"
                        />
                      </span>
                    ) : (
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs sm:text-sm font-bold text-white shadow-sm flex-shrink-0 ring-2 ring-white">
                        {row.name?.trim()[0]?.toUpperCase() ?? 'P'}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className="line-clamp-2 break-words text-sm sm:text-base font-semibold text-gray-900 leading-snug"
                        title={row.name}
                      >
                        {row.name}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-slate-700">
                  {row.client_name || row.client_company_name || '—'}
                </td>
                <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-right font-medium text-[#1E1B4B]">
                  {formatCurrency(row.total_amount)}
                </td>
                <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-right font-medium text-amber-700">
                  {formatCurrency(row.pending_amount)}
                </td>
                <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-right font-medium text-emerald-700">
                  {formatCurrency(row.received_amount)}
                </td>
                <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Tooltip content="Add Payment">
                    <button
                      type="button"
                      onClick={(e) => handlePayNow(e, row)}
                      disabled={row.pending_amount <= 0}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-cyan-50 hover:border-cyan-200 hover:text-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Pay now"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
      <div className="mb-3 flex flex-shrink-0 items-center gap-3">
        <SidebarToggleButton />
        <h1 className="text-xl font-semibold text-[#1E1B4B] sm:text-2xl">Payments</h1>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="w-full sm:w-64">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by project or client..."
          />
        </div>
        <div className="w-full sm:w-48">
          <ListboxDropdown
            value={status}
            options={STATUS_OPTIONS}
            onChange={handleStatusChange}
            ariaLabel="Filter by payment status"
          />
        </div>
      </div>

      {renderContent()}

      {paymentModalProject && (
        <AddPaymentModal
          isOpen={!!paymentModalProject}
          onClose={() => setPaymentModalProject(null)}
          project={{
            id: paymentModalProject.id,
            name: paymentModalProject.name,
            pending_amount: paymentModalProject.pending_amount,
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}
