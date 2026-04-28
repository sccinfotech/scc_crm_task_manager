'use server'

import { createClient } from '@/lib/supabase/server'

type InvoicePaymentStatus = 'unpaid' | 'paid' | 'partial_paid'

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function statusFromPaid(grandTotal: number, paidAmount: number): InvoicePaymentStatus {
  const total = roundCurrency(Math.max(0, Number(grandTotal) || 0))
  const paid = roundCurrency(Math.max(0, Number(paidAmount) || 0))
  if (paid <= 0) return 'unpaid'
  if (paid + 0.00001 >= total) return 'paid'
  return 'partial_paid'
}

export async function allocateAccountingEntryToProjectInvoices(args: {
  projectId: string
  accountingEntryId: string
  amount: number
}): Promise<{ error: string | null }> {
  const projectId = args.projectId
  const entryId = args.accountingEntryId
  const paymentAmount = roundCurrency(Number(args.amount))
  if (!projectId) return { error: 'Project is required' }
  if (!entryId) return { error: 'Payment entry is required' }
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return { error: null }

  const supabase = await createClient()

  // 1) Clear any previous allocations for this entry (supports update flows).
  const { data: prevAllocRows, error: prevAllocErr } = await supabase
    .from('invoice_payment_allocations')
    .select('invoice_id, amount')
    .eq('accounting_entry_id', entryId)

  if (prevAllocErr) return { error: prevAllocErr.message }

  if ((prevAllocRows?.length ?? 0) > 0) {
    const { error: delErr } = await supabase
      .from('invoice_payment_allocations')
      .delete()
      .eq('accounting_entry_id', entryId)
    if (delErr) return { error: delErr.message }
  }

  // 2) Find invoices connected to this project (via invoice_items.project_id),
  // ordered oldest first for predictable allocation.
  const { data: invoiceItemRows, error: invItemErr } = await supabase
    .from('invoice_items')
    .select('invoice_id, invoices(id, invoice_date, created_at, grand_total, paid_amount)')
    .eq('project_id', projectId)

  if (invItemErr) return { error: invItemErr.message }

  const invoicesById = new Map<
    string,
    {
      id: string
      invoice_date: string
      created_at: string
      grand_total: number
      paid_amount: number
    }
  >()

  for (const row of invoiceItemRows ?? []) {
    const inv = (row as any).invoices
    const i = Array.isArray(inv) ? inv[0] : inv
    if (!i?.id) continue
    invoicesById.set(i.id, {
      id: i.id,
      invoice_date: i.invoice_date,
      created_at: i.created_at,
      grand_total: Number(i.grand_total ?? 0),
      paid_amount: Number(i.paid_amount ?? 0),
    })
  }

  const connectedInvoices = [...invoicesById.values()].sort((a, b) => {
    const ad = a.invoice_date || ''
    const bd = b.invoice_date || ''
    if (ad !== bd) return ad < bd ? -1 : 1
    const ac = a.created_at || ''
    const bc = b.created_at || ''
    if (ac !== bc) return ac < bc ? -1 : 1
    return a.id < b.id ? -1 : 1
  })

  if (connectedInvoices.length === 0) return { error: null }

  // 3) Allocate across invoices with remaining balance (grand_total - paid_amount).
  let remaining = paymentAmount
  const allocations: Array<{ invoice_id: string; accounting_entry_id: string; amount: number }> = []

  for (const inv of connectedInvoices) {
    if (remaining <= 0) break
    const grandTotal = roundCurrency(inv.grand_total)
    const alreadyPaid = roundCurrency(inv.paid_amount)
    const due = roundCurrency(Math.max(0, grandTotal - alreadyPaid))
    if (due <= 0) continue
    const applied = roundCurrency(Math.min(due, remaining))
    if (applied <= 0) continue
    allocations.push({ invoice_id: inv.id, accounting_entry_id: entryId, amount: applied })
    remaining = roundCurrency(remaining - applied)
  }

  if (allocations.length > 0) {
    const { error: insErr } = await supabase
      .from('invoice_payment_allocations')
      .insert(allocations as never)
    if (insErr) return { error: insErr.message }
  }

  // 4) Recompute paid_amount + payment_status for affected invoices.
  const affectedInvoiceIds = [...new Set(allocations.map((a) => a.invoice_id).concat((prevAllocRows ?? []).map((r: any) => r.invoice_id)))]
  if (affectedInvoiceIds.length === 0) return { error: null }

  const { data: freshInvoices, error: freshErr } = await supabase
    .from('invoices')
    .select('id, grand_total')
    .in('id', affectedInvoiceIds)
  if (freshErr) return { error: freshErr.message }

  for (const inv of freshInvoices ?? []) {
    const invoiceId = (inv as any).id as string
    const grandTotal = roundCurrency(Number((inv as any).grand_total ?? 0))

    const { data: sumRows, error: sumErr } = await supabase
      .from('invoice_payment_allocations')
      .select('amount')
      .eq('invoice_id', invoiceId)
    if (sumErr) return { error: sumErr.message }

    const paid = roundCurrency(
      (sumRows ?? []).reduce((s, r: any) => s + roundCurrency(Number(r.amount ?? 0)), 0)
    )

    const payment_status = statusFromPaid(grandTotal, paid)
    const { error: updErr } = await supabase
      .from('invoices')
      .update({ paid_amount: paid, payment_status } as never)
      .eq('id', invoiceId)
    if (updErr) return { error: updErr.message }
  }

  return { error: null }
}

export async function removeAllocationsForAccountingEntry(args: {
  accountingEntryId: string
}): Promise<{ error: string | null }> {
  const entryId = args.accountingEntryId
  if (!entryId) return { error: 'Payment entry is required' }

  const supabase = await createClient()
  const { data: allocRows, error: allocErr } = await supabase
    .from('invoice_payment_allocations')
    .select('invoice_id')
    .eq('accounting_entry_id', entryId)
  if (allocErr) return { error: allocErr.message }

  const affectedInvoiceIds = [...new Set((allocRows ?? []).map((r: any) => r.invoice_id).filter(Boolean))]

  const { error: delErr } = await supabase
    .from('invoice_payment_allocations')
    .delete()
    .eq('accounting_entry_id', entryId)
  if (delErr) return { error: delErr.message }

  if (affectedInvoiceIds.length === 0) return { error: null }

  const { data: freshInvoices, error: invErr } = await supabase
    .from('invoices')
    .select('id, grand_total')
    .in('id', affectedInvoiceIds)
  if (invErr) return { error: invErr.message }

  for (const inv of freshInvoices ?? []) {
    const invoiceId = (inv as any).id as string
    const grandTotal = roundCurrency(Number((inv as any).grand_total ?? 0))

    const { data: sumRows, error: sumErr } = await supabase
      .from('invoice_payment_allocations')
      .select('amount')
      .eq('invoice_id', invoiceId)
    if (sumErr) return { error: sumErr.message }

    const paid = roundCurrency(
      (sumRows ?? []).reduce((s, r: any) => s + roundCurrency(Number(r.amount ?? 0)), 0)
    )
    const payment_status = statusFromPaid(grandTotal, paid)

    const { error: updErr } = await supabase
      .from('invoices')
      .update({ paid_amount: paid, payment_status } as never)
      .eq('id', invoiceId)
    if (updErr) return { error: updErr.message }
  }

  return { error: null }
}

