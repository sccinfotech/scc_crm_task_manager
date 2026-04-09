'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { invoiceLineAmount } from '@/lib/invoices/line-amount'
import {
  getNextInvoiceNumber,
  type HsnCodeOption,
  type InvoiceFormData,
  type InvoiceItemFormData,
  type InvoiceType,
} from '@/lib/invoices/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeAmount(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeInvoiceDateInput(value?: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 10)
  const s = String(value)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function emptyItemRow(): InvoiceItemFormData {
  return {
    project_id: null,
    hsn_code_id: null,
    narration: '',
    quantity: 1,
    rate: 0,
    amount: 0,
  }
}

function normalizeInitialItems(items?: InvoiceItemFormData[] | null): InvoiceItemFormData[] {
  if (!items?.length) return [emptyItemRow()]
  return items.map((i) => {
    const amountStored = coerceNumber(i.amount, 0)
    const qtyRaw = coerceNumber(i.quantity, NaN)
    const rateRaw = coerceNumber(i.rate, NaN)
    const quantity = Number.isFinite(qtyRaw) && qtyRaw >= 0 ? qtyRaw : 1
    const rate =
      Number.isFinite(rateRaw) && rateRaw >= 0 ? rateRaw : amountStored
    const amount = invoiceLineAmount(quantity, rate)
    return {
      project_id: i.project_id ?? null,
      hsn_code_id: i.hsn_code_id ? String(i.hsn_code_id) : null,
      narration: i.narration ?? '',
      quantity,
      rate,
      amount,
    }
  })
}

function calcPreviewTotals(input: { invoice_type: InvoiceType; gstTaxType: 'cgst_sgst' | 'igst' | 'none'; items: InvoiceItemFormData[]; discount: number }) {
  const subtotal = roundCurrency(
    input.items.reduce((sum, i) => sum + invoiceLineAmount(i.quantity, i.rate), 0)
  )
  const discount = roundCurrency(Math.max(0, input.discount || 0))
  const taxable = roundCurrency(Math.max(0, subtotal - discount))

  if (input.invoice_type === 'non_gst' || input.gstTaxType === 'none') {
    return {
      subtotal,
      discount,
      cgst: 0,
      sgst: 0,
      igst: 0,
      taxTotal: 0,
      grandTotal: taxable,
      gstLabel: null as string | null,
    }
  }

  if (input.gstTaxType === 'cgst_sgst') {
    const cgst = roundCurrency((taxable * 9) / 100)
    const sgst = roundCurrency((taxable * 9) / 100)
    const taxTotal = roundCurrency(cgst + sgst)
    const grandTotal = roundCurrency(taxable + taxTotal)
    return { subtotal, discount, cgst, sgst, igst: 0, taxTotal, grandTotal, gstLabel: 'CGST 9% + SGST 9%' }
  }

  const igst = roundCurrency((taxable * 18) / 100)
  const taxTotal = igst
  const grandTotal = roundCurrency(taxable + taxTotal)
  return { subtotal, discount, cgst: 0, sgst: 0, igst, taxTotal, grandTotal, gstLabel: 'IGST 18%' }
}

interface InvoiceFormProps {
  initialData?: Partial<InvoiceFormData>
  onSubmit: (formData: InvoiceFormData) => Promise<{ data: any; error: string | null }>
  onSuccess?: () => void
  submitLabel?: string
  disabled?: boolean
  clients: ClientSelectOption[]
  projects: Array<{ id: string; name: string }>
  hsnCodes: HsnCodeOption[]
  invoiceType: InvoiceType
  /** When true, show editable invoice # prefilled with next number for the selected date’s FY. */
  isCreate?: boolean
}

export function InvoiceForm({
  initialData,
  onSubmit,
  onSuccess,
  submitLabel = 'Save Invoice',
  disabled = false,
  clients,
  projects,
  hsnCodes,
  invoiceType,
  isCreate = false,
}: InvoiceFormProps) {
  const inputClasses =
    'block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 sm:text-sm hover:border-slate-300'
  const labelClasses = 'block text-sm font-semibold text-slate-700 mb-1.5'

  const clientOptions = useMemo(() => {
    const rows = (clients || []).map((c) => ({
      value: c.id,
      label: c.company_name ? `${c.name} (${c.company_name})` : c.name,
    }))
    return [{ value: '', label: 'Select client…' }, ...rows]
  }, [clients])
  const projectOptions = useMemo(
    () => (projects || []).map((p) => ({ value: p.id, label: p.name })),
    [projects]
  )

  /** Trigger shows code only; list shows code (label) + title (detail). Search matches both. */
  const hsnItemOptions = useMemo(() => {
    const rows = (hsnCodes || []).map((h) => ({
      value: h.id,
      label: h.code,
      detail: h.title,
    }))
    const placeholder = invoiceType === 'non_gst' ? '—' : 'Select HSN…'
    return [{ value: '', label: placeholder }, ...rows]
  }, [hsnCodes, invoiceType])

  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string>(initialData?.client_id ?? '')
  const [invoiceDate, setInvoiceDate] = useState<string>(normalizeInvoiceDateInput(initialData?.invoice_date))
  const [invoiceNumber, setInvoiceNumber] = useState(() =>
    String(initialData?.invoice_number ?? '').trim()
  )
  const [invoiceNumberLoading, setInvoiceNumberLoading] = useState(false)
  const invoiceNumberTouchedRef = useRef(false)
  const [discount, setDiscount] = useState<number>(coerceNumber(initialData?.discount, 0))
  const [terms, setTerms] = useState<string>(initialData?.terms_and_conditions ?? '')
  const [items, setItems] = useState<InvoiceItemFormData[]>(() => normalizeInitialItems(initialData?.items ?? null))

  // Preview only: tax type depends on client GST + state; we approximate:
  // - If client has gst_number and billing_state_code === 'GJ' => CGST/SGST else IGST.
  const selectedClientMeta = useMemo(() => {
    const c = (clients || []).find((x) => x.id === clientId)
    const gst = (c as any)?.gst_number ? String((c as any).gst_number).trim() : ''
    const state = (c as any)?.billing_state_code ? String((c as any).billing_state_code).trim().toUpperCase() : ''
    return { gst, state }
  }, [clients, clientId])

  const previewGstTaxType = useMemo(() => {
    if (invoiceType === 'non_gst') return 'none' as const
    if (!selectedClientMeta.gst) return 'none' as const
    if (!selectedClientMeta.state) return 'none' as const
    return selectedClientMeta.state === 'GJ' ? ('cgst_sgst' as const) : ('igst' as const)
  }, [invoiceType, selectedClientMeta.gst, selectedClientMeta.state])

  const totals = useMemo(
    () =>
      calcPreviewTotals({
        invoice_type: invoiceType,
        gstTaxType: previewGstTaxType,
        items,
        discount,
      }),
    [invoiceType, previewGstTaxType, items, discount]
  )

  useEffect(() => {
    if (invoiceType === 'non_gst') {
      setItems((prev) => prev.map((row) => ({ ...row, hsn_code_id: null })))
    }
  }, [invoiceType])

  useEffect(() => {
    if (!isCreate) return
    if (invoiceNumberTouchedRef.current) return
    let cancelled = false
    setInvoiceNumberLoading(true)
    getNextInvoiceNumber(invoiceDate || null).then((res) => {
      if (cancelled) return
      setInvoiceNumberLoading(false)
      if (!res.error && res.data) setInvoiceNumber(res.data)
      else setInvoiceNumber('')
    })
    return () => {
      cancelled = true
      setInvoiceNumberLoading(false)
    }
  }, [isCreate, invoiceDate])

  const handleAddRow = () => {
    setItems((prev) => [...prev, emptyItemRow()])
  }

  const handleRemoveRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    setError(null)
    if (!clientId) {
      setError('Client is required.')
      return
    }
    const cleanItems = items
      .map((i) => {
        const quantity = Math.max(0, coerceNumber(i.quantity, 0))
        const rate = Math.max(0, coerceNumber(i.rate, 0))
        const amount = invoiceLineAmount(quantity, rate)
        return {
          project_id: i.project_id && i.project_id.trim() ? i.project_id : null,
          hsn_code_id:
            invoiceType === 'gst' && i.hsn_code_id && String(i.hsn_code_id).trim()
              ? String(i.hsn_code_id).trim()
              : null,
          narration: i.narration?.trim() || null,
          quantity,
          rate,
          amount,
        }
      })
      .filter((i) => i.narration || i.project_id || i.amount > 0)

    if (cleanItems.length === 0) {
      setError('Add at least one line (qty × rate or narration / project).')
      return
    }

    const trimmedNumber = invoiceNumber.trim()
    if (!isCreate && !trimmedNumber) {
      setError('Invoice number is required.')
      return
    }

    if (invoiceType === 'gst') {
      const missingHsn = cleanItems.findIndex((i) => !i.hsn_code_id)
      if (missingHsn !== -1) {
        setError(`Row ${missingHsn + 1}: HSN code is required for GST invoices.`)
        return
      }
    }

    const payload: InvoiceFormData = {
      client_id: clientId,
      invoice_date: invoiceDate,
      invoice_type: invoiceType,
      invoice_number: isCreate ? (trimmedNumber || undefined) : trimmedNumber,
      discount: Math.max(0, discount || 0),
      terms_and_conditions: terms?.trim() || undefined,
      items: cleanItems,
    }

    const result = await onSubmit(payload)
    if (!result.error && onSuccess) onSuccess()
    if (result.error) setError(result.error)
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 animate-fade-in">
          <div className="flex gap-3">
            <svg className="h-5 w-5 text-rose-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-rose-800">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Invoice Information</h3>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="min-w-0">
            <label className={labelClasses}>
              Invoice number
              {!isCreate ? <span className="text-rose-500"> *</span> : null}
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => {
                invoiceNumberTouchedRef.current = true
                setInvoiceNumber(e.target.value)
              }}
              className={inputClasses}
              disabled={disabled || (isCreate && invoiceNumberLoading)}
              placeholder={
                isCreate
                  ? invoiceNumberLoading
                    ? 'Loading next number…'
                    : 'e.g. SCC/26-27/1'
                  : 'e.g. SCC/26-27/1'
              }
              autoComplete="off"
              aria-busy={isCreate ? invoiceNumberLoading : undefined}
            />
          </div>
          <div className="min-w-0">
            <label className={labelClasses}>Client <span className="text-rose-500">*</span></label>
            <ListboxDropdown
              value={clientId}
              options={clientOptions}
              onChange={(v) => setClientId(String(v))}
              ariaLabel="Select client"
            />
          </div>
          <div>
            <label className={labelClasses}>Invoice Date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className={inputClasses}
              disabled={disabled}
            />
          </div>
        </div>

      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-800 leading-tight">Product / Items</h3>
          <button
            type="button"
            onClick={handleAddRow}
            disabled={disabled}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Add row
          </button>
        </div>

        <div className="w-full">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-[22%] px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-700 sm:text-xs">
                  Project
                </th>
                <th className="w-[18%] px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-700 sm:text-xs">
                  HSN{invoiceType === 'gst' ? <span className="text-rose-500"> *</span> : null}
                </th>
                <th className="w-[22%] min-w-0 px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-700 sm:text-xs">
                  Narration
                </th>
                <th className="w-[10%] px-2 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-700 sm:text-xs">
                  Qty
                </th>
                <th className="w-[12%] px-2 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-700 sm:text-xs">
                  Rate
                </th>
                <th className="w-[11%] px-2 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-700 sm:text-xs">
                  Amount
                </th>
                <th className="w-[5%] px-2 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-700 sm:text-xs">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row, idx) => (
                <tr key={idx}>
                  <td className="min-w-0 px-2 py-3 align-middle">
                    <div className="min-w-0">
                      <ListboxDropdown
                        value={row.project_id || ''}
                        options={projectOptions}
                        onChange={(v) =>
                          setItems((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, project_id: String(v) || null } : p))
                          )
                        }
                        ariaLabel="Select project"
                        className="w-full"
                        searchable
                        placeholder="Select project…"
                        searchPlaceholder="Type to search…"
                      />
                    </div>
                  </td>
                  <td className="min-w-0 px-2 py-3 align-middle">
                    <div className="min-w-0">
                      <ListboxDropdown
                        value={row.hsn_code_id || ''}
                        options={hsnItemOptions}
                        onChange={(v) =>
                          setItems((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, hsn_code_id: String(v).trim() || null } : p
                            )
                          )
                        }
                        ariaLabel="Select HSN code for this line"
                        className="w-full"
                        searchable
                        placeholder={invoiceType === 'non_gst' ? '—' : 'Select HSN…'}
                        searchPlaceholder="Search code or title…"
                        disabled={disabled || invoiceType === 'non_gst'}
                      />
                    </div>
                  </td>
                  <td className="min-w-0 px-2 py-3 align-middle">
                    <input
                      type="text"
                      value={row.narration ?? ''}
                      onChange={(e) =>
                        setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, narration: e.target.value } : p)))
                      }
                      className={inputClasses + ' min-w-0'}
                      disabled={disabled}
                      placeholder="Enter narration…"
                    />
                  </td>
                  <td className="min-w-0 px-2 py-3 align-middle">
                    <input
                      type="number"
                      min={0}
                      step="0.0001"
                      value={row.quantity ?? 1}
                      onChange={(e) => {
                        const quantity = Math.max(0, normalizeAmount(e.target.value))
                        setItems((prev) =>
                          prev.map((p, i) =>
                            i === idx
                              ? { ...p, quantity, amount: invoiceLineAmount(quantity, p.rate) }
                              : p
                          )
                        )
                      }}
                      className={inputClasses + ' min-w-0 text-right w-16 px-3 py-2'}
                      disabled={disabled}
                      placeholder="1"
                    />
                  </td>
                  <td className="min-w-0 px-2 py-3 align-middle">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.rate ?? 0}
                      onChange={(e) => {
                        const rate = Math.max(0, normalizeAmount(e.target.value))
                        setItems((prev) =>
                          prev.map((p, i) =>
                            i === idx ? { ...p, rate, amount: invoiceLineAmount(p.quantity, rate) } : p
                          )
                        )
                      }}
                      className={inputClasses + ' min-w-0 text-right w-24 px-3 py-2'}
                      disabled={disabled}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="min-w-0 px-2 py-3 align-middle">
                    <div className="min-w-0 text-right tabular-nums font-semibold text-slate-900" title="Qty × Rate">
                      {formatCurrency(invoiceLineAmount(row.quantity, row.rate))}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right align-middle">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      disabled={disabled || items.length <= 1}
                      className="inline-flex h-10 w-10 items-center justify-center text-slate-500 transition-colors hover:text-rose-700 disabled:opacity-50"
                      aria-label="Remove row"
                      title="Remove row"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m5 0H6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Terms &amp; Conditions</h3>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className={`${inputClasses} resize-none`}
            rows={6}
            disabled={disabled}
            placeholder="Enter terms and conditions..."
          />
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Bill Summary</h3>

          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Sub total</span>
              <span className="font-semibold text-slate-900">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-slate-600">Discount</div>
                <div className="text-[11px] text-slate-400">Flat amount</div>
              </div>
              <div className="w-36">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, normalizeAmount(e.target.value)))}
                  className={`${inputClasses} text-right font-semibold`}
                  disabled={disabled}
                  placeholder="0.00"
                  aria-label="Discount"
                />
              </div>
            </div>

            {invoiceType === 'gst' && previewGstTaxType !== 'none' && (
              <>
                {previewGstTaxType === 'cgst_sgst' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">CGST (9%)</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(totals.cgst)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">SGST (9%)</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(totals.sgst)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">IGST (18%)</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(totals.igst)}</span>
                  </div>
                )}
              </>
            )}

            {invoiceType === 'gst' && previewGstTaxType === 'none' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                GST is selected, but GST type cannot be derived yet. Add Client GST Number and Billing State Code to enable GST.
              </div>
            )}

            <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
              <span className="text-slate-700 font-bold">Grand Total</span>
              <span className="text-slate-900 font-extrabold">{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled}
            className="btn-gradient-smooth w-full rounded-xl px-4 py-4 text-sm font-bold text-white shadow-xl shadow-[#06B6D4]/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

