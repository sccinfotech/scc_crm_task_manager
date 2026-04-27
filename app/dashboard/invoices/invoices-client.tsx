'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SidebarToggleButton } from '@/app/components/dashboard/sidebar-context'
import { Pagination } from '@/app/components/ui/pagination'
import { InvoicesFilters } from './invoices-filters'
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
  type HsnCodeOption,
} from '@/lib/invoices/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import { InvoiceModal } from './invoice-modal'
import { downloadInvoicePdf } from '@/lib/invoices/pdf-download'

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
const INVOICE_DETAILS_QUERY_PARAM = 'invoiceId'

interface InvoicesClientProps {
  invoices: InvoiceListItem[]
  totalCount: number
  page: number
  pageSize: number
  initialSearch: string
  initialClientId: string
  initialStatus: InvoicePaymentStatus | 'all'
  initialSortField: string
  initialSortDirection: 'asc' | 'desc'
  canWrite: boolean
  isAdmin: boolean
  clients: ClientSelectOption[]
  projects: Array<{ id: string; name: string }>
  hsnCodes: HsnCodeOption[]
}

export function InvoicesClient({
  invoices,
  totalCount,
  page,
  pageSize,
  initialSearch,
  initialClientId,
  initialStatus,
  initialSortField,
  initialSortDirection,
  canWrite,
  isAdmin,
  clients,
  projects,
  hsnCodes,
}: InvoicesClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
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

  const [detailsInvoiceId, setDetailsInvoiceId] = useState<string | null>(() => {
    return searchParams.get(INVOICE_DETAILS_QUERY_PARAM) ?? null
  })
  const [detailsInvoice, setDetailsInvoice] = useState<Invoice | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)

  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [clientFilter, setClientFilter] = useState<string>(initialClientId)
  const [statusFilter, setStatusFilter] = useState<InvoicePaymentStatus | 'all'>(initialStatus)
  const [sortField, setSortField] = useState<InvoiceSortField>(
    (initialSortField as InvoiceSortField) || 'created_at'
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection)

  const clientFilterOptions = useMemo(() => {
    const rows = (clients || []).map((c) => ({
      value: c.id,
      label: c.company_name ? `${c.name} (${c.company_name})` : c.name,
    }))
    return [{ value: '', label: 'All clients' }, ...rows]
  }, [clients])

  const buildSearchParams = useCallback(
    (updates: {
      search?: string
      client?: string
      status?: InvoicePaymentStatus | 'all'
      sort?: InvoiceSortField
      sortDir?: 'asc' | 'desc'
      page?: number
    }) => {
      const params = new URLSearchParams()
      const search = updates.search !== undefined ? updates.search : searchQuery
      const client = updates.client !== undefined ? updates.client : clientFilter
      const status = updates.status !== undefined ? updates.status : statusFilter
      const sort = updates.sort !== undefined ? updates.sort : sortField
      const sortDir = updates.sortDir !== undefined ? updates.sortDir : sortDirection
      const pageNum = updates.page !== undefined ? updates.page : page

      if (search) params.set('search', search)
      if (client) params.set('client', client)
      if (status && status !== 'all') params.set('status', status)
      if (sort) {
        params.set('sort', sort)
        params.set('sortDir', sortDir)
      }
      if (pageNum > 1) params.set('page', String(pageNum))
      return params.toString()
    },
    [searchQuery, clientFilter, statusFilter, sortField, sortDirection, page]
  )

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    router.push(`${pathname}?${buildSearchParams({ search: query, page: 1 })}`)
  }

  const handleClientFilterChange = (value: string) => {
    const next = String(value)
    setClientFilter(next)
    router.push(`${pathname}?${buildSearchParams({ client: next, page: 1 })}`)
  }

  const handleStatusChange = (value: string) => {
    const next = (value as InvoicePaymentStatus | 'all') ?? 'all'
    setStatusFilter(next)
    router.push(`${pathname}?${buildSearchParams({ status: next, page: 1 })}`)
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setClientFilter('')
    setStatusFilter('all')
    router.push(`${pathname}?${buildSearchParams({ search: '', client: '', status: 'all', page: 1 })}`)
  }

  const handleSort = (field: InvoiceSortField) => {
    const nextDir = sortField === field ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc'
    setSortField(field)
    setSortDirection(nextDir)
    router.push(`${pathname}?${buildSearchParams({ sort: field, sortDir: nextDir, page: 1 })}`)
  }

  const handleRefresh = () => router.refresh()

  /** Keep URL in sync with detailsInvoiceId for deep linking without triggering RSC refresh. */
  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const urlId = params.get(INVOICE_DETAILS_QUERY_PARAM)
    if (detailsInvoiceId !== urlId) {
      if (detailsInvoiceId) params.set(INVOICE_DETAILS_QUERY_PARAM, detailsInvoiceId)
      else params.delete(INVOICE_DETAILS_QUERY_PARAM)
      const query = params.toString()
      const nextUrl = query ? `${pathname}?${query}` : pathname
      window.history.replaceState(null, '', nextUrl)
    }
  }, [detailsInvoiceId, pathname])

  /** Handle browser back/forward buttons: sync state when URL changes externally. */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      setDetailsInvoiceId(params.get(INVOICE_DETAILS_QUERY_PARAM))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const loadInvoiceDetails = useCallback(
    async (invoiceId: string) => {
      setDetailsLoading(true)
      setDetailsInvoice(null)
      const result = await getInvoice(invoiceId)
      setDetailsLoading(false)
      if (result.error) {
        showError('Load failed', result.error)
        setDetailsInvoiceId(null)
        return
      }
      setDetailsInvoice(result.data ?? null)
    },
    [showError]
  )

  useEffect(() => {
    if (!detailsInvoiceId) {
      setDetailsInvoice(null)
      setDetailsLoading(false)
      return
    }
    loadInvoiceDetails(detailsInvoiceId)
  }, [detailsInvoiceId, loadInvoiceDetails])

  const handleDetailsOpen = (invoiceId: string) => setDetailsInvoiceId(invoiceId)
  const handleDetailsClose = () => setDetailsInvoiceId(null)

  /** Include projects linked on the invoice but missing from the global list (e.g. beyond limit or renamed). */
  const projectsForEditModal = useMemo(() => {
    if (!selectedInvoice?.items?.length) return projects
    const byId = new Map(projects.map((p) => [p.id, p]))
    for (const row of selectedInvoice.items) {
      if (row.project_id && row.project_name && !byId.has(row.project_id)) {
        byId.set(row.project_id, { id: row.project_id, name: row.project_name })
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, selectedInvoice])

  const hsnCodesForEditModal = useMemo(() => {
    const byId = new Map(hsnCodes.map((h) => [h.id, h]))
    for (const row of selectedInvoice?.items ?? []) {
      if (row.hsn_code_id && row.hsn_code && !byId.has(row.hsn_code_id)) {
        byId.set(row.hsn_code_id, {
          id: row.hsn_code_id,
          code: row.hsn_code.code,
          title: row.hsn_code.title,
          description: row.hsn_code.description ?? '',
        })
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  }, [hsnCodes, selectedInvoice])

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

  const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    if (pdfDownloading) return
    setPdfDownloading(true)
    try {
      const safeName = invoiceNumber.replace(/[^\w.\-()/]+/g, '_')
      await downloadInvoicePdf(invoiceId, `${safeName}.pdf`)
    } catch {
      showError('Download failed', 'Unable to download the invoice PDF right now.')
    } finally {
      setPdfDownloading(false)
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
          <InvoicesFilters
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            clientFilter={clientFilter}
            clientOptions={clientFilterOptions}
            onClientChange={handleClientFilterChange}
            statusFilter={statusFilter}
            statusOptions={STATUS_OPTIONS}
            onStatusChange={handleStatusChange}
            onClearFilters={handleClearFilters}
          />

          <div className="flex-1 overflow-y-auto">
            {invoices.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6">
                <EmptyState
                  title={clientFilter ? 'No invoices for this client' : 'No invoices yet'}
                  description={
                    clientFilter
                      ? 'Try another client or clear the client filter. Invoices for the selected client will appear here.'
                      : 'Create your first invoice to start tracking GST/Non‑GST totals and payment status.'
                  }
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
                        <article
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-slate-50/40 transition-colors"
                          onClick={() => handleDetailsOpen(row.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') handleDetailsOpen(row.id)
                          }}
                          aria-label={`View invoice ${row.invoice_number}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold text-slate-900 truncate">{row.invoice_number}</h3>
                              <p className="mt-0.5 text-sm text-slate-600">{row.client_name}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                  {row.invoice_date}
                                </span>
                                {row.hsn_code ? (
                                  <span
                                    className="max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                                    title={row.hsn_title ? `${row.hsn_code} — ${row.hsn_title}` : row.hsn_code}
                                  >
                                    <span className="font-semibold text-slate-900">HSN</span>{' '}
                                    {row.hsn_code}
                                    {row.hsn_title ? (
                                      <span className="text-slate-500"> — {row.hsn_title}</span>
                                    ) : null}
                                  </span>
                                ) : null}
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
                                onMouseDown={(e) => e.stopPropagation()}
                                onClickCapture={(e) => e.stopPropagation()}
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
                                onMouseDown={(e) => e.stopPropagation()}
                                onClickCapture={(e) => e.stopPropagation()}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 disabled:opacity-50"
                                aria-label="Delete invoice"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m5 0H6" />
                                </svg>
                              </button>
                            </Tooltip>
                            <Tooltip content="Download PDF">
                              <button
                                type="button"
                                onClick={() => void handleDownloadPdf(row.id, row.invoice_number)}
                                disabled={pdfDownloading}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClickCapture={(e) => e.stopPropagation()}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-sky-50 hover:border-sky-200 hover:text-sky-800 disabled:opacity-50"
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
                  <table className="w-full min-w-[1000px]">
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
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B] w-[200px]">
                          HSN
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
                          <tr
                            key={row.id}
                            className="hover:bg-slate-50/50 cursor-pointer"
                            onClick={() => handleDetailsOpen(row.id)}
                            aria-label={`View invoice ${row.invoice_number}`}
                          >
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.invoice_number}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{row.invoice_date}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{row.client_name}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {row.hsn_code ? (
                                <div
                                  className="max-w-[220px]"
                                  title={row.hsn_title ? `${row.hsn_code} — ${row.hsn_title}` : row.hsn_code}
                                >
                                  <span className="font-semibold text-slate-900">{row.hsn_code}</span>
                                  {row.hsn_title ? (
                                    <span className="block truncate text-xs text-slate-500">{row.hsn_title}</span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
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
                                <Tooltip content="Download PDF">
                                  <button
                                    type="button"
                                    onClick={() => void handleDownloadPdf(row.id, row.invoice_number)}
                                    disabled={pdfDownloading}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-sky-50 hover:border-sky-200 hover:text-sky-800 disabled:opacity-50"
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
        hsnCodes={hsnCodes}
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
        formKey={
          selectedInvoiceId
            ? selectedInvoice
              ? `${selectedInvoiceId}:${selectedInvoice.updated_at}`
              : `${selectedInvoiceId}:pending`
            : 'edit'
        }
        clients={clients}
        projects={projectsForEditModal}
        hsnCodes={hsnCodesForEditModal}
        initialData={
          selectedInvoice
            ? {
                invoice_number: selectedInvoice.invoice_number,
                client_id: selectedInvoice.client_id,
                invoice_date: selectedInvoice.invoice_date,
                invoice_type: selectedInvoice.invoice_type,
                discount: selectedInvoice.discount,
                terms_and_conditions: selectedInvoice.terms_and_conditions ?? undefined,
                items:
                  selectedInvoice.items?.map((i) => ({
                    project_id: i.project_id,
                    hsn_code_id: i.hsn_code_id,
                    narration: i.narration,
                    quantity: i.quantity,
                    rate: i.rate,
                    amount: i.amount,
                  })) ?? [],
              }
            : undefined
        }
      />

      <InvoiceDetailsModal
        isOpen={Boolean(detailsInvoiceId)}
        invoice={detailsInvoice}
        loading={detailsLoading}
        onClose={handleDetailsClose}
        onEdit={(id) => {
          handleDetailsClose()
          handleEditOpen(id)
        }}
        onDownloadPdf={
          detailsInvoice
            ? () => void handleDownloadPdf(detailsInvoice.id, detailsInvoice.invoice_number)
            : undefined
        }
        pdfDownloading={pdfDownloading}
        canWrite={canWrite}
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

function formatDateLabel(isoDate: string) {
  if (!isoDate) return '—'

  const plainDateMatch = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (plainDateMatch) {
    const [, yearText, monthText, dayText] = plainDateMatch
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', {
      timeZone: 'UTC',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate

  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(value)
}

function InvoiceDetailsModal({
  isOpen,
  invoice,
  loading,
  onClose,
  onEdit,
  onDownloadPdf,
  pdfDownloading,
  canWrite,
}: {
  isOpen: boolean
  invoice: Invoice | null
  loading: boolean
  onClose: () => void
  onEdit: (id: string) => void
  onDownloadPdf?: () => void
  pdfDownloading?: boolean
  canWrite: boolean
}) {
  if (!isOpen) return null

  const isNonGst = invoice?.invoice_type === 'non_gst'
  const documentLabel = isNonGst ? 'Challan' : 'Invoice'
  const dateLabel = isNonGst ? 'Created date' : 'Invoice date'
  const dateValue = invoice ? formatDateLabel(isNonGst ? invoice.created_at : invoice.invoice_date) : '—'

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${documentLabel} details`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 p-3 sm:p-4">
        <div className="relative h-full w-full rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{documentLabel}</div>
              <div className="truncate text-base font-extrabold text-[#1E1B4B]">
                {invoice?.invoice_number ?? (loading ? 'Loading…' : '—')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onDownloadPdf ? (
                <Tooltip content={pdfDownloading ? 'Preparing PDF…' : 'Download PDF'}>
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    disabled={pdfDownloading || loading}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-900 disabled:opacity-50"
                    aria-label={`Download ${documentLabel.toLowerCase()} PDF`}
                  >
                    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 8l-3-3m3 3l3-3M4 20h16" />
                    </svg>
                    <span className="hidden sm:inline">{pdfDownloading ? 'PDF…' : 'PDF'}</span>
                  </button>
                </Tooltip>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
                aria-label={`Close ${documentLabel.toLowerCase()} details`}
                title="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="h-[calc(100%-56px)] overflow-y-auto">
            {loading ? (
              <div className="p-4 sm:p-6 space-y-5 animate-pulse" aria-busy="true">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[1, 2, 3].map((k) => (
                    <div key={k} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                      <div className="h-3 w-20 rounded bg-slate-200" />
                      <div className="mt-2 h-5 w-40 rounded bg-slate-200" />
                      <div className="mt-2 h-3 w-28 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="h-4 w-24 rounded bg-slate-200" />
                    <div className="h-3 w-16 rounded bg-slate-200" />
                  </div>
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4].map((r) => (
                      <div key={r} className="grid grid-cols-5 gap-3">
                        <div className="col-span-2 h-4 rounded bg-slate-200" />
                        <div className="col-span-1 h-4 rounded bg-slate-200" />
                        <div className="col-span-1 h-4 rounded bg-slate-200" />
                        <div className="col-span-1 h-4 rounded bg-slate-200" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                    <div className="h-3 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-full rounded bg-slate-200" />
                    <div className="h-4 w-11/12 rounded bg-slate-200" />
                    <div className="h-4 w-10/12 rounded bg-slate-200" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                    <div className="h-3 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-full rounded bg-slate-200" />
                    <div className="h-4 w-10/12 rounded bg-slate-200" />
                    <div className="h-4 w-9/12 rounded bg-slate-200" />
                  </div>
                </div>
              </div>
            ) : !invoice ? (
              <div className="p-6 text-sm text-slate-600">Invoice not found.</div>
            ) : (
              <div className="p-4 sm:p-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Client</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{invoice.client?.name ?? '—'}</div>
                    {invoice.client?.company_name ? (
                      <div className="text-xs text-slate-600">{invoice.client.company_name}</div>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{dateLabel}</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{dateValue}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment status</div>
                    <div className="mt-2">
                      {(() => {
                        const badge = STATUS_BADGE[invoice.payment_status]
                        return (
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm font-extrabold text-slate-800">Items</div>
                    <div className="text-xs font-semibold text-slate-500">{invoice.items?.length ?? 0} lines</div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] table-fixed">
                      <thead>
                        <tr className="border-b border-slate-200 bg-white text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          <th className="px-3 py-2 w-[36%]">Project</th>
                          <th className="px-3 py-2 w-[16%]">HSN</th>
                          <th className="px-3 py-2 w-[10%] text-right">Qty</th>
                          <th className="px-3 py-2 w-[13%] text-right">Rate</th>
                          <th className="px-3 py-2 w-[13%] text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {(invoice.items ?? []).map((it) => (
                          <tr key={it.id} className="text-sm">
                            <td className="px-3 py-2 text-slate-900 align-top">
                              <div className="font-semibold">{it.project_name ?? '—'}</div>
                              {it.narration?.trim() ? (
                                <div className="mt-1 text-xs font-normal text-slate-600 whitespace-pre-wrap">
                                  {it.narration}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {it.hsn_code?.code ? (
                                <span title={it.hsn_code.title ? `${it.hsn_code.code} — ${it.hsn_code.title}` : it.hsn_code.code}>
                                  <span className="font-semibold text-slate-900">{it.hsn_code.code}</span>
                                  {it.hsn_code.title ? (
                                    <span className="block truncate text-xs text-slate-500">{it.hsn_code.title}</span>
                                  ) : null}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                              {formatNumber(it.quantity)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                              {formatCurrency(it.rate)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">
                              {formatCurrency(it.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Terms</div>
                    <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                      {invoice.terms_and_conditions?.trim() ? invoice.terms_and_conditions : '—'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</div>
                    <div className="mt-2 space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Subtotal</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(invoice.subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Discount</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(invoice.discount)}</span>
                      </div>
                      {invoice.invoice_type === 'gst' && invoice.gst_tax_type !== 'none' ? (
                        invoice.gst_tax_type === 'cgst_sgst' ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">CGST ({invoice.cgst_rate}%)</span>
                              <span className="font-semibold text-slate-900">{formatCurrency(invoice.cgst_amount)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">SGST ({invoice.sgst_rate}%)</span>
                              <span className="font-semibold text-slate-900">{formatCurrency(invoice.sgst_amount)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">IGST ({invoice.igst_rate}%)</span>
                            <span className="font-semibold text-slate-900">{formatCurrency(invoice.igst_amount)}</span>
                          </div>
                        )
                      ) : null}
                      <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
                        <span className="font-extrabold text-slate-800">Grand total</span>
                        <span className="font-extrabold text-[#1E1B4B]">{formatCurrency(invoice.grand_total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
