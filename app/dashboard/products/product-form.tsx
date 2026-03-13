'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { ProductFormData } from '@/lib/products/actions'
import { getProductLogoUploadSignature } from '@/lib/products/actions'
import { useToast } from '@/app/components/ui/toast-context'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'

interface ProductFormProps {
  initialData?: ProductFormData
  onSubmit: (formData: ProductFormData) => Promise<{ error: string | null }>
  onSuccess: () => void
  submitLabel: string
  clients: ClientSelectOption[]
  clientsError: string | null
  mode?: 'create' | 'edit'
}

type SubscriptionRow = {
  client_id: string
  renew_date: string
}

function addOneYearFromToday(): string {
  const today = new Date()
  const next = new Date(today)
  next.setFullYear(today.getFullYear() + 1)
  return next.toISOString().slice(0, 10)
}

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024

export function ProductForm({
  initialData,
  onSubmit,
  onSuccess,
  submitLabel,
  clients,
  clientsError,
  mode = 'create',
}: ProductFormProps) {
  const { error: showError } = useToast()
  const [name, setName] = useState(initialData?.name ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [iconUrl, setIconUrl] = useState(initialData?.icon_url ?? '')
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string>('')
  const [iconError, setIconError] = useState<string | null>(null)
  const [isAnnual, setIsAnnual] = useState(initialData?.is_annual_subscription ?? true)
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(
    initialData?.subscriptions?.map((s) => s.client_id) ?? []
  )
  const [subscriptionsByClient, setSubscriptionsByClient] = useState<Record<string, SubscriptionRow>>(() => {
    const map: Record<string, SubscriptionRow> = {}
    initialData?.subscriptions?.forEach((s) => {
      map[s.client_id] = { client_id: s.client_id, renew_date: s.renew_date }
    })
    return map
  })
  const [submitting, setSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingLogoFileRef = useRef<File | null>(null)

  useEffect(() => {
    return () => {
      if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl)
    }
  }, [iconPreviewUrl])

  const uploadLogoFile = async (file: File): Promise<string | null> => {
    const signatureResult = await getProductLogoUploadSignature()
    if (signatureResult.error || !signatureResult.data) {
      throw new Error(signatureResult.error || 'Failed to prepare logo upload.')
    }
    const signature = signatureResult.data
    const form = new FormData()
    form.append('file', file)
    form.append('api_key', signature.apiKey)
    form.append('timestamp', String(signature.timestamp))
    form.append('signature', signature.signature)
    form.append('folder', signature.folder)

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
      { method: 'POST', body: form }
    )
    if (!response.ok) throw new Error('Upload failed')
    const data = await response.json()
    return data.secure_url ?? null
  }

  const handleClientToggle = (clientId: string, checked: boolean) => {
    setSelectedClientIds((prev) => {
      if (checked) {
        if (prev.includes(clientId)) return prev
        // ensure renew date exists
        setSubscriptionsByClient((old) => {
          if (old[clientId]) return old
          return {
            ...old,
            [clientId]: { client_id: clientId, renew_date: addOneYearFromToday() },
          }
        })
        return [...prev, clientId]
      }
      return prev.filter((id) => id !== clientId)
    })
  }

  const handleRenewDateChange = (clientId: string, value: string) => {
    setSubscriptionsByClient((prev) => ({
      ...prev,
      [clientId]: { client_id: clientId, renew_date: value },
    }))
  }

  const subscriptionRows: SubscriptionRow[] = useMemo(
    () => selectedClientIds.map((id) => subscriptionsByClient[id] ?? { client_id: id, renew_date: addOneYearFromToday() }),
    [selectedClientIds, subscriptionsByClient]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      showError('Validation error', 'Product name is required.')
      return
    }
    let finalIconUrl: string | undefined = iconUrl?.trim() || undefined
    const pendingFile = pendingLogoFileRef.current
    if (pendingFile) {
      try {
        const uploaded = await uploadLogoFile(pendingFile)
        if (uploaded) finalIconUrl = uploaded
        pendingLogoFileRef.current = null
      } catch (err) {
        console.error('Product logo upload failed:', err)
        showError('Upload failed', 'Could not upload product logo. Please try again.')
        return
      }
    }

    const payload: ProductFormData = {
      name: name.trim(),
      description: description.trim(),
      icon_url: finalIconUrl,
      is_annual_subscription: isAnnual,
      subscriptions: subscriptionRows,
    }

    setSubmitting(true)
    const result = await onSubmit(payload)
    setSubmitting(false)
    if (!result.error) {
      onSuccess()
    }
  }

  const handleLogoClick = () => {
    fileInputRef.current?.click()
  }

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setIconError('Logo must be 2 MB or less.')
      event.target.value = ''
      return
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      setIconError('Logo must be PNG or JPG.')
      event.target.value = ''
      return
    }

    setIconError(null)
    if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl)
    setIconPreviewUrl(URL.createObjectURL(file))
    pendingLogoFileRef.current = file
    event.target.value = ''
  }

  const handleRemoveLogo = () => {
    if (iconPreviewUrl) {
      URL.revokeObjectURL(iconPreviewUrl)
      setIconPreviewUrl('')
    }
    setIconUrl('')
    pendingLogoFileRef.current = null
    setIconError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const displayIconUrl = iconPreviewUrl || iconUrl
  const hasLogo = Boolean(displayIconUrl)

  const inputClasses =
    'block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 sm:text-sm'
  const labelClasses = 'block text-sm font-semibold text-slate-700 mb-1.5'

  const availableClientOptions = useMemo(
    () =>
      clients
        .filter((c) => !selectedClientIds.includes(c.id))
        .map((c) => ({
          value: c.id,
          label: c.company_name ? `${c.name} (${c.company_name})` : c.name,
        })),
    [clients, selectedClientIds]
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/40 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)] md:items-stretch">
          <div className="space-y-4">
            <div>
              <label className={labelClasses}>
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter product name"
                className={inputClasses}
              />
            </div>

            <div>
              <label className={labelClasses}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Short description about this product"
                className={inputClasses}
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsAnnual(!isAnnual)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  isAnnual ? 'bg-cyan-500' : 'bg-gray-200'
                }`}
                aria-pressed={isAnnual}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isAnnual ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">Is Annual Subscription</span>
                <span className="text-xs text-gray-500">
                  Toggle off if this product is not billed annually.
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <label className={labelClasses}>Product logo</label>
            <p className="text-xs text-slate-500 mb-3">Optional · PNG or JPG · Max 2 MB</p>
            <div
              role="button"
              tabIndex={0}
              onClick={handleLogoClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleLogoClick()
                }
              }}
              className={`
                group relative flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
                min-h-[120px] w-full overflow-hidden
                ${hasLogo
                  ? 'border-slate-200 bg-slate-50/50 hover:border-cyan-300 hover:bg-cyan-50/30 p-4 sm:p-5'
                  : 'border-slate-200 bg-white hover:border-[#06B6D4] hover:bg-[#06B6D4]/5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 p-3'
                }
              `}
            >
              {hasLogo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayIconUrl}
                    alt="Product logo"
                    className="max-h-32 max-w-full rounded-lg object-contain shadow-sm border border-slate-100 bg-white"
                  />
                  <p className="mt-3 text-sm font-medium text-slate-600">Click to change</p>
                  {iconPreviewUrl ? (
                    <p className="mt-1 text-xs text-slate-500">Logo will upload when you save</p>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition-colors duration-200 group-hover:bg-[#06B6D4]/10 group-hover:text-[#06B6D4]">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-600">Click to select</p>
                </>
              )}
            </div>
            {hasLogo && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleLogoClick() }}
                  className="text-xs font-medium text-[#06B6D4] transition-colors duration-200 hover:text-[#0891b2] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-1 rounded-lg px-2 py-1"
                >
                  Change logo
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemoveLogo() }}
                  className="text-xs font-medium text-rose-600 transition-colors duration-200 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 rounded-lg px-2 py-1"
                >
                  Remove
                </button>
              </div>
            )}
            {iconError && (
              <p className="mt-2 text-xs text-rose-600" role="alert">
                {iconError}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>
        </div>
      </div>

      {mode === 'create' && (
      <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#1E1B4B]">Clients</h3>
            <p className="text-xs text-gray-500">
              Search and select clients. Renew date defaults to 1 year from today{isAnnual ? '' : ' (hidden when annual is off)'}.
            </p>
          </div>
        </div>

        {clientsError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Failed to load clients: {clientsError}
          </div>
        )}

        <div className="space-y-3">
          <div className="max-w-md">
            <label className={labelClasses}>Add client</label>
            <ListboxDropdown
              id="product_client_select"
              value=""
              options={availableClientOptions.length ? [{ value: '', label: 'Select client' }, ...availableClientOptions] : [{ value: '', label: 'No more clients' }]}
              onChange={(id) => {
                if (!id) return
                handleClientToggle(id, true)
              }}
              ariaLabel="Add client"
              placeholder="Select client"
              className="min-h-[2.75rem]"
              searchable={true}
            />
          </div>

          {selectedClientIds.length > 0 && (
            <div className="mt-2 rounded-xl border border-gray-100 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 bg-slate-50/80">
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">Client</th>
                    <th className="hidden sm:table-cell px-3 py-2">Company</th>
                    {isAnnual && <th className="px-3 py-2 w-32">Renew date</th>}
                    <th className="px-3 py-2 w-10 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {selectedClientIds.map((clientId) => {
                    const client = clients.find((c) => c.id === clientId)
                    const row = subscriptionsByClient[clientId]
                    const value = row?.renew_date ?? addOneYearFromToday()
                    return (
                      <tr key={clientId}>
                        <td className="px-3 py-2 align-middle">
                          <div className="truncate font-medium text-gray-900">
                            {client?.name ?? 'Unknown client'}
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-3 py-2 align-middle">
                          <div className="truncate text-gray-500">
                            {client?.company_name || '—'}
                          </div>
                        </td>
                        {isAnnual && (
                          <td className="px-3 py-2 align-middle">
                            <input
                              type="date"
                              value={value}
                              onChange={(e) => handleRenewDateChange(clientId, e.target.value)}
                              className="block w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                            />
                          </td>
                        )}
                        <td className="px-3 py-2 align-middle text-right">
                          <button
                            type="button"
                            onClick={() => handleClientToggle(clientId, false)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            aria-label="Remove client"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onSuccess}
          className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

