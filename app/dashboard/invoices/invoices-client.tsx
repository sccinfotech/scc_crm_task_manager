'use client'

import { useCallback, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SidebarToggleButton } from '@/app/components/dashboard/sidebar-context'
import { Pagination } from '@/app/components/ui/pagination'
import { SearchInput } from '@/app/components/ui/search-input'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'
import { EmptyState } from '@/app/components/empty-state'
import {
  createInvoice,
  deleteInvoice,
  getInvoice,
  updateInvoice,
  type Invoice,
  type InvoiceFormData,
  type InvoiceListItem,
  type InvoicePaymentStatus,
} from '@/lib/invoices/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import { InvoiceModal } from './invoice-modal'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

const STATUS_OPTIONS: Array<{ value: InvoicePaymentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial_paid', label: 'Partial Paid' },
  { value: 'paid', label: 'Paid' },
]

const STATUS_BADGE: Record<InvoicePaymentStatus, { label: string; className: string }> = {
  unpaid: { label: 'Unpaid', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  partial_paid: { label: 'Partial Paid', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
}

type InvoiceSortField = 'invoice_number' | 'invoice_date' | 'grand_total' | 'payment_status' | 'created_at'

interface InvoicesClientProps {
  invoices: InvoiceListItem[]
  totalCount: number
  page: number
  pageSize: number
  initialSearch: string
  initialStatus: InvoicePaymentStatus | 'all'
  initialSortField: string
  initialSortDirection: 'asc' | 'desc'
  canWrite: boolean
  isAdmin: boolean
  clients: ClientSelectOption[]
  projects: Array<{ id: string; name: string }>
}

export function InvoicesClient({
  invoices,
  totalCount,
  page,
  pageSize,
  initialSearch,
  initialStatus,
  initialSortField,
  initialSortDirection,
  canWrite,
  isAdmin,
  clients,
  projects,
}: InvoicesClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { success: showSuccess, error: showError } = useToast()

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [deleteInvoiceNumber, setDeleteInvoiceNumber] = useState('')

  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<InvoicePaymentStatus | 'all'>(initialStatus)
  const [sortField, setSortField] = useState<InvoiceSortField>(
    (initialSortField as InvoiceSortField) || 'created_at'
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection)

  const buildSearchParams = useCallback(
    (updates: {
      search?: string
      status?: InvoicePaymentStatus | 'all'
      sort?: InvoiceSortField
      sortDir?: 'asc' | 'desc'
      page?: number
    }) => {
      const params = new URLSearchParams()
      const search = updates.search !== undefined ? updates.search : searchQuery
      const status = updates.status !== undefined ? updates.status : statusFilter
      const sort = updates.sort !== undefined ? updates.sort : sortField
      const sortDir = updates.sortDir !== undefined ? updates.sortDir : sortDirection
      const pageNum = updates.page !== undefined ? updates.page : page

      if (search) params.set('search', search)
      if (status && status !== 'all') params.set('status', status)
      if (sort) {
        params.set('sort', sort)
        params.set('sortDir', sortDir)
      }
      if (pageNum > 1) params.set('page', String(pageNum))
      return params.toString()
    },
    [searchQuery, statusFilter, sortField, sortDirection, page]
  )

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    router.push(`${pathname}?${buildSearchParams({ search: query, page: 1 })}`)
  }

  const handleStatusChange = (value: string) => {
    const next = (value as InvoicePaymentStatus | 'all') ?? 'all'
    setStatusFilter(next)
    router.push(`${pathname}?${buildSearchParams({ status: next, page: 1 })}`)
  }

  const handleSort = (field: InvoiceSortField) => {
    const nextDir = sortField === field ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc'
    setSortField(field)
    setSortDirection(nextDir)
    router.push(`${pathname}?${buildSearchParams({ sort: field, sortDir: nextDir, page: 1 })}`)
  }

  const handleRefresh = () => router.refresh()

  const handleCreate = async (payload: InvoiceFormData) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to create invoices.')
      return { data: null, error: 'Permission denied' }
    }
    setSaving(true)
    const result = await createInvoice(payload)
    setSaving(false)
    if (!result.error && result.data) {
      showSuccess('Invoice Created', `Invoice ${result.data.invoice_number} has been created.`)
      setCreateModalOpen(false)
      router.refresh()
    } else {
      showError('Creation Failed', result.error ?? 'Failed to create invoice')
    }
    return result
  }

  const handleEditOpen = async (invoiceId: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to edit invoices.')
      return
    }
    setSelectedInvoiceId(invoiceId)
    setEditModalOpen(true)
    setEditLoading(true)
    const result = await getInvoice(invoiceId)
    setEditLoading(false)
    if (result.data) {
      setSelectedInvoice(result.data)
    } else {
      showError('Error', result.error || 'Failed to load invoice for editing')
      setEditModalOpen(false)
      setSelectedInvoiceId(null)
      setSelectedInvoice(null)
    }
  }

  const handleUpdate = async (payload: InvoiceFormData) => {
    if (!selectedInvoiceId) return { data: null, error: 'No invoice selected' }
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to edit invoices.')
      return { data: null, error: 'Permission denied' }
    }
    setSaving(true)
    const result = await updateInvoice(selectedInvoiceId, payload)
    setSaving(false)
    if (!result.error) {
      showSuccess('Invoice Updated', 'Invoice has been updated successfully.')
      setEditModalOpen(false)
      setSelectedInvoiceId(null)
      setSelectedInvoice(null)
      router.refresh()
    } else {
      showError('Update Failed', result.error || 'Failed to update invoice')
    }
    return result
  }

  const handleDeleteOpen = (invoiceId: string, invoiceNumber: string) => {
    if (!isAdmin) {
      showError('Permission Denied', 'Only administrators can delete invoices.')
      return
    }
    setSelectedInvoiceId(invoiceId)
    setDeleteInvoiceNumber(invoiceNumber)
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedInvoiceId) return
    if (!isAdmin) {
      showError('Permission Denied', 'Only administrators can delete invoices.')
      return
    }
    setDeleting(true)
    const result = await deleteInvoice(selectedInvoiceId)
    setDeleting(false)
    if (!result.error) {
      showSuccess('Invoice Deleted', `${deleteInvoiceNumber} has been deleted.`)
      setDeleteModalOpen(false)
      setSelectedInvoiceId(null)
      setDeleteInvoiceNumber('')
      router.refresh()
    } else {
      showError('Delete Failed', result.error || 'Failed to delete invoice')
    }
  }

  return (
    <>
      <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
          <div className="flex items-center gap-3">
            <SidebarToggleButton />
            <h1 className="text-xl font-semibold text-[#1E1B4B] sm:text-2xl">Invoices</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Tooltip content="Refresh invoices">
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:px-3 sm:py-2.5"
                aria-label="Refresh invoices"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              disabled={!canWrite}
              title={canWrite ? 'Create invoice' : 'Read-only access'}
              className={`btn-gradient-smooth rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 sm:px-5 sm:py-2.5 ${!canWrite ? 'hover:shadow-lg hover:-translate-y-0' : ''}`}
            >
              Add Invoice
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-64">
              <SearchInput value={searchQuery} onChange={handleSearchChange} placeholder="Search invoice number..." />
            </div>
            <div className="w-full sm:w-56">
              <ListboxDropdown
                value={statusFilter}
                options={STATUS_OPTIONS}
                onChange={handleStatusChange}
                ariaLabel="Filter by payment status"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {invoices.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6">
                <EmptyState
                  title="No invoices yet"
                  description="Create your first invoice to start tracking GST/Non‑GST totals and payment status."
                />
              </div>
            ) : (
              <>
                {/* Mobile: card list (only below md) */}
                <ul className="list-none space-y-3 p-3 md:hidden" aria-label="Invoices list">
                  {invoices.map((row) => {
                    const badge = STATUS_BADGE[row.payment_status]
                    return (
                      <li key={row.id}>
                        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold text-slate-900 truncate">{row.invoice_number}</h3>
                              <p className="mt-0.5 text-sm text-slate-600">{row.client_name}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                  {row.invoice_date}
                                </span>
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                                  {badge.label}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</div>
                              <div className="text-base font-extrabold text-[#1E1B4B]">
                                {formatCurrency(row.grand_total)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
                            <Tooltip content="Edit">
                              <button
                                type="button"
                                onClick={() => handleEditOpen(row.id)}
                                disabled={!canWrite}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-cyan-50 hover:border-cyan-200 hover:text-cyan-700 disabled:opacity-50"
                                aria-label="Edit invoice"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </Tooltip>
                            <Tooltip content="Delete">
                              <button
                                type="button"
                                onClick={() => handleDeleteOpen(row.id, row.invoice_number)}
                                disabled={!isAdmin}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 disabled:opacity-50"
                                aria-label="Delete invoice"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m5 0H6" />
                                </svg>
                              </button>
                            </Tooltip>
                            <Tooltip content="Download PDF (coming soon)">
                              <button
                                type="button"
                                onClick={() => showError('Coming soon', 'PDF generation will be added later.')}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
                                aria-label="Download invoice PDF"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 8l-3-3m3 3l3-3M4 20h16" />
                                </svg>
                              </button>
                            </Tooltip>
                          </div>
                        </article>
                      </li>
                    )
                  })}
                </ul>

                {/* Desktop: table (md and up) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] cursor-pointer"
                          onClick={() => handleSort('invoice_number')}
                        >
                          Invoice #
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] cursor-pointer"
                          onClick={() => handleSort('invoice_date')}
                        >
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
                          Client
                        </th>
                        <th
                          className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] cursor-pointer"
                          onClick={() => handleSort('grand_total')}
                        >
                          Total Amount
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] cursor-pointer"
                          onClick={() => handleSort('payment_status')}
                        >
                          Payment Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {invoices.map((row) => {
                        const badge = STATUS_BADGE[row.payment_status]
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.invoice_number}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{row.invoice_date}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{row.client_name}</td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-[#1E1B4B]">
                              {formatCurrency(row.grand_total)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Tooltip content="Edit">
                                  <button
                                    type="button"
                                    onClick={() => handleEditOpen(row.id)}
                                    disabled={!canWrite}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-cyan-50 hover:border-cyan-200 hover:text-cyan-700 disabled:opacity-50"
                                    aria-label="Edit invoice"
                                  >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                </Tooltip>
                                <Tooltip content="Delete">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOpen(row.id, row.invoice_number)}
                                    disabled={!isAdmin}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 disabled:opacity-50"
                                    aria-label="Delete invoice"
                                  >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m5 0H6" />
                                    </svg>
                                  </button>
                                </Tooltip>
                                <Tooltip content="Download PDF (coming soon)">
                                  <button
                                    type="button"
                                    onClick={() => showError('Coming soon', 'PDF generation will be added later.')}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
                                    aria-label="Download invoice PDF"
                                  >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 8l-3-3m3 3l3-3M4 20h16" />
                                    </svg>
                                  </button>
                                </Tooltip>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {totalCount > pageSize && (
            <Pagination
              currentPage={page}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={(newPage) => router.push(`${pathname}?${buildSearchParams({ page: newPage })}`)}
              className="hidden md:flex"
            />
          )}
        </div>
      </div>

      <InvoiceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        mode="create"
        onSubmit={handleCreate}
        isLoading={saving}
        formKey="create"
        clients={clients}
        projects={projects}
      />

      <InvoiceModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditLoading(false)
          setSelectedInvoiceId(null)
          setSelectedInvoice(null)
        }}
        mode="edit"
        onSubmit={handleUpdate}
        isLoading={editLoading || saving}
        formKey={selectedInvoiceId ?? 'edit'}
        clients={clients}
        projects={projects}
        initialData={
          selectedInvoice
            ? {
                client_id: selectedInvoice.client_id,
                invoice_date: selectedInvoice.invoice_date,
                invoice_type: selectedInvoice.invoice_type,
                discount: selectedInvoice.discount,
                terms_and_conditions: selectedInvoice.terms_and_conditions ?? undefined,
                items:
                  selectedInvoice.items?.map((i) => ({
                    project_id: i.project_id,
                    narration: i.narration,
                    amount: i.amount,
                  })) ?? [],
              }
            : undefined
        }
      />

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-[#1E1B4B]">Delete Invoice</h2>
            </div>
            <div className="px-6 py-6">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete invoice <span className="font-semibold">{deleteInvoiceNumber}</span>? This
                action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false)
                  setSelectedInvoiceId(null)
                  setDeleteInvoiceNumber('')
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

