'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { ProductClientSubscription, ProductListItem } from '@/lib/products/actions'
import {
  addProductSubscription,
  deleteProductSubscription,
  getProductSubscriptions,
  renewProductSubscription,
} from '@/lib/products/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useToast } from '@/app/components/ui/toast-context'

interface ProductClientsModalProps {
  isOpen: boolean
  onClose: () => void
  product: ProductListItem | null
  clients: ClientSelectOption[]
  canWrite: boolean
}

interface AddClientModalState {
  isOpen: boolean
}

function addOneYearFromToday(): string {
  const today = new Date()
  const next = new Date(today)
  next.setFullYear(today.getFullYear() + 1)
  return next.toISOString().slice(0, 10)
}

function getStatusAndRemaining(renewDate: string) {
  // `renewDate` is stored as a DATE in DB and comes in as `YYYY-MM-DD`.
  // Renew is date-only, so compute countdown until end-of-day for that date.
  // Use UTC for consistent day boundaries across timezones.
  const parts = renewDate.split('-').map((x) => Number(x))
  const [y, m, d] = parts
  if (!y || !m || !d) return { status: 'Expired', label: '-', isActive: false }

  const msPerHour = 1000 * 60 * 60
  const msPerDay = 1000 * 60 * 60 * 24

  const now = Date.now()
  const todayUTCmidnight = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  const renewUTCmidnight = Date.UTC(y, m - 1, d)

  const diffDays = Math.floor((renewUTCmidnight - todayUTCmidnight) / msPerDay)
  const isActive = diffDays >= 0

  if (!isActive) {
    return { status: 'Expired', label: '-', isActive: false }
  }

  const endOfRenewUTC = Date.UTC(y, m - 1, d, 23, 59, 59, 999)
  const remainingMs = endOfRenewUTC - now
  const totalHours = Math.max(0, Math.floor(remainingMs / msPerHour))

  const totalDays = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  // Approximate month length as 30 days.
  const months = Math.floor(totalDays / 30)
  const days = totalDays % 30

  return { status: 'Active', label: `${months}m ${days}d ${hours}h`, isActive: true }
}

export function ProductClientsModal({
  isOpen,
  onClose,
  product,
  clients,
  canWrite,
}: ProductClientsModalProps) {
  const { success: showSuccess, error: showError } = useToast()
  const [subscriptions, setSubscriptions] = useState<ProductClientSubscription[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renewingId, setRenewingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [addClientModal, setAddClientModal] = useState<AddClientModalState>({ isOpen: false })
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [newRenewDate, setNewRenewDate] = useState<string>(addOneYearFromToday())
  const [adding, setAdding] = useState(false)
  const [renewModalOpen, setRenewModalOpen] = useState(false)
  const [renewClientId, setRenewClientId] = useState<string>('')
  const [renewClientName, setRenewClientName] = useState<string>('')
  const [renewDate, setRenewDate] = useState<string>(addOneYearFromToday())
  const [savingRenew, setSavingRenew] = useState(false)
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [removeClientId, setRemoveClientId] = useState<string>('')
  const [removeClientName, setRemoveClientName] = useState<string>('')

  useEffect(() => {
    if (!product) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      const result = await getProductSubscriptions(product.id)
      setLoading(false)
      if (result.error || !result.data) {
        setError(result.error || 'Failed to load clients.')
        return
      }
      setSubscriptions(result.data)
    }

    void fetchData()
  }, [isOpen, product])

  useEffect(() => {
    if (!isOpen) {
      setSubscriptions([])
      setError(null)
      setRenewingId(null)
      setRemovingId(null)
      setAddClientModal({ isOpen: false })
      setSelectedClientId('')
      setNewRenewDate(addOneYearFromToday())
      setRenewModalOpen(false)
      setRenewClientId('')
      setRenewClientName('')
      setRenewDate(addOneYearFromToday())
      setSavingRenew(false)
      setRemoveConfirmOpen(false)
      setRemoveClientId('')
      setRemoveClientName('')
    }
  }, [isOpen])

  const existingClientIds = useMemo(
    () => new Set(subscriptions.map((s) => s.client_id)),
    [subscriptions]
  )

  const availableClientOptions = useMemo(
    () =>
      clients
        .filter((c) => !existingClientIds.has(c.id))
        .map((c) => ({
          value: c.id,
          label: c.company_name ? `${c.name} (${c.company_name})` : c.name,
        })),
    [clients, existingClientIds]
  )

  if (!product) return null

  const handleOpenRenew = (sub: ProductClientSubscription) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to renew subscriptions.')
      return
    }
    setRenewClientId(sub.client_id)
    setRenewClientName(sub.client_name)
    // default to 1 year from today, but could also prefill with existing renew date
    setRenewDate(addOneYearFromToday())
    setRenewModalOpen(true)
  }

  const handleConfirmRenew = async () => {
    if (!canWrite || !renewClientId) return
    setSavingRenew(true)
    const result = await renewProductSubscription(product.id, renewClientId, renewDate)
    setSavingRenew(false)
    if (result.error) {
      showError('Renew Failed', result.error)
      return
    }
    showSuccess('Subscription Renewed', 'Client subscription has been renewed.')
    setRenewModalOpen(false)
    setRenewClientId('')
    setRenewClientName('')
    const refreshed = await getProductSubscriptions(product.id)
    if (!refreshed.error && refreshed.data) {
      setSubscriptions(refreshed.data)
    }
  }

  const handleRemove = async (clientId: string, clientName: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to remove clients.')
      return
    }
    setRemovingId(clientId)
    const result = await deleteProductSubscription(product.id, clientId)
    setRemovingId(null)
    if (result.error) {
      showError('Remove Failed', result.error)
      return
    }
    showSuccess('Client Removed', `"${clientName}" has been disconnected from this product.`)
    setSubscriptions((prev) => prev.filter((s) => s.client_id !== clientId))
  }

  const handleOpenRemoveConfirm = (clientId: string, clientName: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to remove clients.')
      return
    }
    setRemoveClientId(clientId)
    setRemoveClientName(clientName)
    setRemoveConfirmOpen(true)
  }

  const handleConfirmRemove = async () => {
    if (!canWrite || !removeClientId) return
    setRemovingId(removeClientId)
    const result = await deleteProductSubscription(product.id, removeClientId)
    setRemovingId(null)
    if (result.error) {
      showError('Remove Failed', result.error)
      return
    }
    showSuccess('Client Removed', `"${removeClientName}" has been disconnected from this product.`)
    setSubscriptions((prev) => prev.filter((s) => s.client_id !== removeClientId))
    setRemoveConfirmOpen(false)
    setRemoveClientId('')
    setRemoveClientName('')
  }

  const handleOpenAddClient = () => {
    setSelectedClientId('')
    setNewRenewDate(addOneYearFromToday())
    setAddClientModal({ isOpen: true })
  }

  const handleAddClient = async () => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to add clients.')
      return
    }
    if (!selectedClientId) {
      showError('Validation error', 'Please select a client.')
      return
    }
    setAdding(true)
    const result = await addProductSubscription(
      product.id,
      selectedClientId,
      product.is_annual_subscription ? newRenewDate : undefined
    )
    setAdding(false)
    if (result.error) {
      showError('Add Client Failed', result.error)
      return
    }
    showSuccess('Client Added', 'Client has been connected to this product.')
    setAddClientModal({ isOpen: false })
    const refreshed = await getProductSubscriptions(product.id)
    if (!refreshed.error && refreshed.data) {
      setSubscriptions(refreshed.data)
    }
  }

  return (
    <div className="flex h-full flex-col px-2 py-2 sm:px-3 sm:py-3">
      <div className="relative mx-auto flex h-full max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">
              Manage Clients
            </p>
            <h2 className="text-lg font-bold text-slate-900">{product.name}</h2>
            <p className="text-xs text-slate-500">
              View and manage clients connected to this product.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 px-3 py-3 sm:px-4 sm:py-3">
          {loading && (
            <div className="mb-3 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
              Loading clients...
            </div>
          )}
          {error && (
            <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Connected clients</h3>
            <button
              type="button"
              disabled={!canWrite || availableClientOptions.length === 0}
              onClick={handleOpenAddClient}
              className="inline-flex items-center rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add client
            </button>
          </div>

          {subscriptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-center text-sm text-slate-500">
              No clients are connected to this product yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full table-auto text-xs">
                <thead className="bg-slate-50/80">
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 text-left">Client</th>
                    <th className="hidden sm:table-cell px-3 py-2 text-left">Company</th>
                    {product.is_annual_subscription && (
                      <th className="px-3 py-2 text-left">Renew date</th>
                    )}
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Remaining Time</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptions.map((sub) => {
                    const { status, label, isActive } = getStatusAndRemaining(sub.renew_date)
                    return (
                      <tr key={sub.id}>
                        <td className="px-3 py-2 align-middle">
                          <div className="truncate text-xs font-semibold text-slate-900">
                            {sub.client_name}
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-3 py-2 align-middle">
                          <div className="truncate text-xs text-slate-500">
                            {sub.client_company_name || '—'}
                          </div>
                        </td>
                        {product.is_annual_subscription && (
                          <td className="px-3 py-2 align-middle">
                            <div className="text-xs text-slate-700">{sub.renew_date}</div>
                          </td>
                        )}
                        <td className="px-3 py-2 align-middle">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20'
                                : 'bg-rose-50 text-rose-700 ring-1 ring-rose-500/20'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isActive ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            {status}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <div className="text-xs font-semibold text-slate-700">{label}</div>
                        </td>
                        <td className="px-3 py-2 align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {product.is_annual_subscription && (
                              <Tooltip content="Renew subscription" position="top">
                                <button
                                  type="button"
                                  disabled={!canWrite}
                                  onClick={() => handleOpenRenew(sub)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-cyan-600 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                </button>
                              </Tooltip>
                            )}
                            <Tooltip content="Remove client" position="top">
                              <button
                                type="button"
                                disabled={removingId === sub.client_id || !canWrite}
                                onClick={() => handleOpenRemoveConfirm(sub.client_id, sub.client_name)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                              >
                                {removingId === sub.client_id ? (
                                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                )}
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
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>

      {addClientModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-3">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Add client</h2>
                <p className="text-xs text-slate-500">
                  Select a client to connect to this product.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddClientModal({ isOpen: false })}
                className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
                aria-label="Close add client"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Client
                </label>
                <ListboxDropdown
                  id="product_add_client_select"
                  value={selectedClientId}
                  options={
                    availableClientOptions.length
                      ? [{ value: '' as string, label: 'Select client' }, ...availableClientOptions]
                      : [{ value: '' as string, label: 'No more clients' }]
                  }
                  onChange={(val) => setSelectedClientId(val)}
                  ariaLabel="Select client"
                  placeholder="Select client"
                  className="min-h-[2.75rem]"
                  searchable={true}
                />
              </div>
              {product.is_annual_subscription && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Renew date
                  </label>
                  <input
                    type="date"
                    value={newRenewDate}
                    onChange={(e) => setNewRenewDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setAddClientModal({ isOpen: false })}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adding}
                onClick={handleAddClient}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adding ? 'Adding...' : 'Add client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renewModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-3">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Renew subscription</h2>
                <p className="text-xs text-slate-500">
                  Set the next renew date for{' '}
                  <span className="font-semibold text-slate-800">{renewClientName}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRenewModalOpen(false)}
                className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
                aria-label="Close renew"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Next renew date
                </label>
                <input
                  type="date"
                  value={renewDate}
                  onChange={(e) => setRenewDate(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setRenewModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingRenew}
                onClick={handleConfirmRenew}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingRenew ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {removeConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-3">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Remove client</h2>
              <button
                type="button"
                onClick={() => setRemoveConfirmOpen(false)}
                className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
                aria-label="Close remove confirm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-100">
                  <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01M5.07 19h13.86A2 2 0 0021 17.09L19.09 5.52A2 2 0 0017.11 4H6.89A2 2 0 004.91 5.52L3 17.09A2 2 0 005.07 19z"
                    />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    Remove client from this product?
                  </p>
                  <p className="text-sm text-slate-600">
                    Client{' '}
                    <span className="font-semibold text-slate-900">
                      {removeClientName}
                    </span>{' '}
                    will no longer have an active subscription for this product. This action cannot be
                    undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setRemoveConfirmOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingId === removeClientId}
                onClick={handleConfirmRemove}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removingId === removeClientId ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

