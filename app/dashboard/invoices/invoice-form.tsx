'use client'

import { useMemo, useState } from 'react'
import type { InvoiceFormData, InvoiceItemFormData, InvoiceType } from '@/lib/invoices/actions'
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

function calcPreviewTotals(input: { invoice_type: InvoiceType; gstTaxType: 'cgst_sgst' | 'igst' | 'none'; items: InvoiceItemFormData[]; discount: number }) {
  const subtotal = roundCurrency(input.items.reduce((sum, i) => sum + Math.max(0, i.amount || 0), 0))
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
  invoiceType: InvoiceType
}

export function InvoiceForm({
  initialData,
  onSubmit,
  onSuccess,
  submitLabel = 'Save Invoice',
  disabled = false,
  clients,
  projects,
  invoiceType,
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

  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string>(initialData?.client_id ?? '')
  const [invoiceDate, setInvoiceDate] = useState<string>(
    initialData?.invoice_date ?? new Date().toISOString().slice(0, 10)
  )
  const [discount, setDiscount] = useState<number>(initialData?.discount ?? 0)
  const [terms, setTerms] = useState<string>(initialData?.terms_and_conditions ?? '')
  const [items, setItems] = useState<InvoiceItemFormData[]>(
    (initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [{ project_id: null, narration: '', amount: 0 }]) as InvoiceItemFormData[]
  )

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

  const handleAddRow = () => {
    setItems((prev) => [...prev, { project_id: null, narration: '', amount: 0 }])
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
      .map((i) => ({
        project_id: i.project_id && i.project_id.trim() ? i.project_id : null,
        narration: i.narration?.trim() || null,
        amount: Math.max(0, Number(i.amount || 0)),
      }))
      .filter((i) => i.narration || i.project_id || i.amount > 0)

    if (cleanItems.length === 0) {
      setError('Add at least one item (with amount).')
      return
    }

    const payload: InvoiceFormData = {
      client_id: clientId,
      invoice_date: invoiceDate,
      invoice_type: invoiceType,
      discount: Math.max(0, discount || 0),
      terms_and_conditions: terms?.trim() || undefined,
      items: cleanItems,
    }

    const result = await onSubmit(payload)
    if (!result.error && onSuccess) onSuccess()
    if (result.error) setError(result.error)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
          <p className="text-sm font-medium text-rose-800">{error}</p>
        </div>
      )}

      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Invoice Information</h3>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className={labelClasses}>Client <span className="text-rose-500">*</span></label>
            <ListboxDropdown
              value={clientId}
              options={clientOptions}
              onChange={(v) => setClientId(String(v))}
              ariaLabel="Select client"
              className="min-h-[2.75rem]"
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

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Product / Items</h3>
            <p className="text-xs text-slate-500">Project, narration, amount</p>
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            disabled={disabled}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Add row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 w-[340px]">Project</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Narration</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-700 w-[140px]">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3 align-top">
                    <div className="min-w-[320px]">
                      <ListboxDropdown
                        value={row.project_id || ''}
                        options={projectOptions}
                        onChange={(v) =>
                          setItems((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, project_id: String(v) || null } : p))
                          )
                        }
                        ariaLabel="Select project"
                        className="min-h-[2.5rem] w-full"
                        searchable
                        placeholder="Select project…"
                        searchPlaceholder="Type to search…"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      type="text"
                      value={row.narration ?? ''}
                      onChange={(e) =>
                        setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, narration: e.target.value } : p)))
                      }
                      className={inputClasses}
                      disabled={disabled}
                      placeholder="Enter narration…"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.amount ?? 0}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, amount: Math.max(0, normalizeAmount(e.target.value)) } : p))
                        )
                      }
                      className={inputClasses + ' text-right'}
                      disabled={disabled}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      disabled={disabled || items.length <= 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 disabled:opacity-50"
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

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Terms &amp; Conditions</h3>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className={`${inputClasses} resize-none`}
            rows={6}
            disabled={disabled}
            placeholder="Enter terms and conditions..."
          />
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bill Summary</h3>

          <div className="space-y-2 text-sm">
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
                  className="no-number-spinner block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-right font-semibold text-slate-900 shadow-sm focus:border-[#06B6D4] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 hover:border-slate-300"
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

            <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
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

