'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { prepareSearchTerm } from '@/lib/supabase/utils'
import { createActivityLogEntry } from '@/lib/activity-log/logger'

export type InvoiceType = 'gst' | 'non_gst'
export type InvoiceGstTaxType = 'cgst_sgst' | 'igst' | 'none'
export type InvoicePaymentStatus = 'unpaid' | 'paid' | 'partial_paid'

export type InvoiceItemFormData = {
  project_id?: string | null
  narration?: string | null
  amount: number
}

export type InvoiceFormData = {
  client_id: string
  invoice_date?: string
  invoice_type: InvoiceType
  discount?: number
  terms_and_conditions?: string
  items: InvoiceItemFormData[]
}

export type InvoiceListItem = {
  id: string
  invoice_number: string
  invoice_date: string
  client_id: string
  client_name: string
  grand_total: number
  payment_status: InvoicePaymentStatus
  created_at: string
}

export type Invoice = {
  id: string
  invoice_number: string
  invoice_date: string
  client_id: string
  invoice_type: InvoiceType
  gst_tax_type: InvoiceGstTaxType
  subtotal: number
  discount: number
  cgst_rate: number
  cgst_amount: number
  sgst_rate: number
  sgst_amount: number
  igst_rate: number
  igst_amount: number
  total_tax: number
  grand_total: number
  terms_and_conditions: string | null
  payment_status: InvoicePaymentStatus
  created_by: string
  created_at: string
  updated_at: string
  client?: { id: string; name: string; company_name: string | null } | null
  items?: Array<{
    id: string
    invoice_id: string
    project_id: string | null
    project_name?: string | null
    narration: string | null
    amount: number
    created_at: string
  }>
}

export type GetInvoicesPageOptions = {
  search?: string
  status?: InvoicePaymentStatus | 'all'
  sortField?: 'invoice_number' | 'invoice_date' | 'grand_total' | 'payment_status' | 'created_at'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeNumber(value?: number | string | null): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function getFinancialYearLabel(d: Date) {
  const year = d.getFullYear()
  const month = d.getMonth() // 0-11
  // FY starts April
  const startYear = month >= 3 ? year : year - 1
  const endYear = startYear + 1
  const yy = (n: number) => String(n).slice(-2)
  return `${yy(startYear)}-${yy(endYear)}`
}

async function generateInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceDate: string | null
): Promise<string> {
  const d = invoiceDate ? new Date(`${invoiceDate}T00:00:00.000Z`) : new Date()
  const fy = getFinancialYearLabel(d)
  const prefix = `SCC/${fy}/`

  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(25)

  if (error) {
    console.error('Error generating invoice number:', error)
  }

  const rows = (data as Array<{ invoice_number: string }> | null) ?? []
  let maxSeq = 0
  for (const r of rows) {
    const n = r.invoice_number
    if (!n.startsWith(prefix)) continue
    const tail = n.slice(prefix.length)
    const seq = Number.parseInt(tail, 10)
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq
  }
  return `${prefix}${maxSeq + 1}`
}

async function deriveGstTaxTypeForClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  invoiceType: InvoiceType
): Promise<{ gst_tax_type: InvoiceGstTaxType; error: string | null }> {
  if (invoiceType === 'non_gst') {
    return { gst_tax_type: 'none', error: null }
  }

  const { data, error } = await supabase
    .from('clients')
    .select('gst_number, billing_state_code')
    .eq('id', clientId)
    .single()

  if (error || !data) {
    return { gst_tax_type: 'none', error: error?.message ?? 'Client not found' }
  }

  const row = data as { gst_number: string | null; billing_state_code: string | null }
  const gstNo = row.gst_number?.trim() || ''
  if (!gstNo) {
    return { gst_tax_type: 'none', error: 'Client GST Number is required for GST invoice' }
  }

  const state = (row.billing_state_code?.trim() || '').toUpperCase()
  if (!state) {
    return { gst_tax_type: 'none', error: 'Client Billing State Code is required for GST invoice' }
  }

  return { gst_tax_type: state === 'GJ' ? 'cgst_sgst' : 'igst', error: null }
}

function calcTotals(input: {
  invoice_type: InvoiceType
  gst_tax_type: InvoiceGstTaxType
  items: InvoiceItemFormData[]
  discount: number
}) {
  const subtotal = roundCurrency(
    (input.items || []).reduce((sum, item) => sum + Math.max(0, normalizeNumber(item.amount)), 0)
  )
  const discount = roundCurrency(Math.max(0, input.discount))
  const taxable = roundCurrency(Math.max(0, subtotal - discount))

  if (input.invoice_type === 'non_gst' || input.gst_tax_type === 'none') {
    return {
      subtotal,
      discount,
      gst: {
        gst_tax_type: 'none' as InvoiceGstTaxType,
        cgst_rate: 0,
        cgst_amount: 0,
        sgst_rate: 0,
        sgst_amount: 0,
        igst_rate: 0,
        igst_amount: 0,
        total_tax: 0,
      },
      grand_total: taxable,
    }
  }

  if (input.gst_tax_type === 'cgst_sgst') {
    const cgst_rate = 9
    const sgst_rate = 9
    const cgst_amount = roundCurrency((taxable * cgst_rate) / 100)
    const sgst_amount = roundCurrency((taxable * sgst_rate) / 100)
    const total_tax = roundCurrency(cgst_amount + sgst_amount)
    const grand_total = roundCurrency(taxable + total_tax)
    return {
      subtotal,
      discount,
      gst: {
        gst_tax_type: 'cgst_sgst' as InvoiceGstTaxType,
        cgst_rate,
        cgst_amount,
        sgst_rate,
        sgst_amount,
        igst_rate: 0,
        igst_amount: 0,
        total_tax,
      },
      grand_total,
    }
  }

  const igst_rate = 18
  const igst_amount = roundCurrency((taxable * igst_rate) / 100)
  const total_tax = igst_amount
  const grand_total = roundCurrency(taxable + total_tax)
  return {
    subtotal,
    discount,
    gst: {
      gst_tax_type: 'igst' as InvoiceGstTaxType,
      cgst_rate: 0,
      cgst_amount: 0,
      sgst_rate: 0,
      sgst_amount: 0,
      igst_rate,
      igst_amount,
      total_tax,
    },
    grand_total,
  }
}

export async function getInvoicesPage(
  options: GetInvoicesPageOptions = {}
): Promise<{ data: InvoiceListItem[]; totalCount: number; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: [], totalCount: 0, error: 'You must be logged in to view invoices' }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.invoices, 'read')
  if (!canRead) {
    return { data: [], totalCount: 0, error: 'You do not have permission to view invoices' }
  }

  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  const sortField = options.sortField ?? 'created_at'
  const sortDirection = options.sortDirection ?? 'desc'
  const searchTerm = prepareSearchTerm(options.search)

  const supabase = await createClient()

  let query = supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, client_id, grand_total, payment_status, created_at, clients(id,name)', {
      count: 'exact',
    })

  if (searchTerm) {
    query = query.or(`invoice_number.ilike.%${searchTerm}%`)
  }
  if (options.status && options.status !== 'all') {
    query = query.eq('payment_status', options.status)
  }

  query = query.order(sortField, { ascending: sortDirection === 'asc' })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.range(from, to)
  if (error) {
    console.error('Error fetching invoices:', error)
    return { data: [], totalCount: 0, error: error.message || 'Failed to fetch invoices' }
  }

  const rows = (data || []) as Array<{
    id: string
    invoice_number: string
    invoice_date: string
    client_id: string
    grand_total: number
    payment_status: string
    created_at: string
    clients: { id: string; name: string } | { id: string; name: string }[] | null
  }>

  const list: InvoiceListItem[] = rows.map((r) => {
    const client = Array.isArray(r.clients) ? r.clients[0] : r.clients
    return {
      id: r.id,
      invoice_number: r.invoice_number,
      invoice_date: r.invoice_date,
      client_id: r.client_id,
      client_name: client?.name ?? '—',
      grand_total: r.grand_total,
      payment_status: (r.payment_status || 'unpaid') as InvoicePaymentStatus,
      created_at: r.created_at,
    }
  })

  return { data: list, totalCount: count ?? 0, error: null }
}

export async function getInvoice(id: string): Promise<{ data: Invoice | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { data: null, error: 'You must be logged in' }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.invoices, 'read')
  if (!canRead) return { data: null, error: 'You do not have permission to view invoices' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients(id,name,company_name)')
    .eq('id', id)
    .single()

  if (error || !data) {
    return { data: null, error: error?.message ?? 'Invoice not found' }
  }

  const invoiceRow = data as Invoice & { clients?: Invoice['client'] | Invoice['client'][] }
  const client = Array.isArray(invoiceRow.clients) ? invoiceRow.clients[0] : invoiceRow.clients

  const { data: itemRows } = await supabase
    .from('invoice_items')
    .select('id, invoice_id, project_id, narration, amount, created_at, projects(name)')
    .eq('invoice_id', id)
    .order('created_at', { ascending: true })

  const items = ((itemRows as any[]) || []).map((r) => ({
    id: r.id,
    invoice_id: r.invoice_id,
    project_id: r.project_id ?? null,
    project_name: Array.isArray(r.projects) ? r.projects[0]?.name ?? null : r.projects?.name ?? null,
    narration: r.narration ?? null,
    amount: Number(r.amount ?? 0),
    created_at: r.created_at,
  }))

  const { clients: _clients, ...rest } = invoiceRow as any
  return {
    data: {
      ...(rest as Invoice),
      client: client ?? null,
      items,
    },
    error: null,
  }
}

export async function createInvoice(formData: InvoiceFormData): Promise<{ data: Invoice | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { data: null, error: 'You must be logged in to create an invoice' }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.invoices, 'write')
  if (!canWrite) return { data: null, error: 'You do not have permission to create invoices' }

  if (!formData.client_id) return { data: null, error: 'Client is required' }
  const items = Array.isArray(formData.items) ? formData.items : []
  if (items.length === 0) return { data: null, error: 'Add at least one item' }

  const supabase = await createClient()
  const invoice_date = formData.invoice_date || null
  const invoice_number = await generateInvoiceNumber(supabase, invoice_date)

  const invoice_type = (formData.invoice_type || 'gst') as InvoiceType
  if (!['gst', 'non_gst'].includes(invoice_type)) {
    return { data: null, error: 'Invalid invoice type' }
  }

  const derived = await deriveGstTaxTypeForClient(supabase, formData.client_id, invoice_type)
  if (derived.error) return { data: null, error: derived.error }

  const discount = normalizeNumber(formData.discount)
  const totals = calcTotals({
    invoice_type,
    gst_tax_type: derived.gst_tax_type,
    items,
    discount,
  })

  const { data: inserted, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number,
      invoice_date: invoice_date || undefined,
      client_id: formData.client_id,
      invoice_type,
      gst_tax_type: totals.gst.gst_tax_type,
      subtotal: totals.subtotal,
      discount: totals.discount,
      cgst_rate: totals.gst.cgst_rate,
      cgst_amount: totals.gst.cgst_amount,
      sgst_rate: totals.gst.sgst_rate,
      sgst_amount: totals.gst.sgst_amount,
      igst_rate: totals.gst.igst_rate,
      igst_amount: totals.gst.igst_amount,
      total_tax: totals.gst.total_tax,
      grand_total: totals.grand_total,
      terms_and_conditions: formData.terms_and_conditions?.trim() || null,
      payment_status: 'unpaid',
      created_by: currentUser.id,
    } as never)
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('Error creating invoice:', error)
    return { data: null, error: error?.message ?? 'Failed to create invoice' }
  }

  const invoiceId = (inserted as { id: string }).id
  const itemRows = items.map((i) => ({
    invoice_id: invoiceId,
    project_id: i.project_id || null,
    narration: i.narration?.trim() || null,
    amount: Math.max(0, normalizeNumber(i.amount)),
    created_by: currentUser.id,
  }))

  const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows as never)
  if (itemsError) {
    await supabase.from('invoices').delete().eq('id', invoiceId)
    console.error('Error creating invoice items:', itemsError)
    return { data: null, error: itemsError.message ?? 'Failed to save invoice items' }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Create',
    moduleName: 'Invoices',
    recordId: invoiceId,
    description: `Created invoice ${invoice_number}`,
    status: 'Success',
  })

  revalidatePath('/dashboard/invoices')
  return getInvoice(invoiceId)
}

export async function updateInvoice(
  id: string,
  formData: InvoiceFormData
): Promise<{ data: Invoice | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { data: null, error: 'You must be logged in to update an invoice' }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.invoices, 'write')
  if (!canWrite) return { data: null, error: 'You do not have permission to update invoices' }

  const supabase = await createClient()
  const { data: existing, error: fetchError } = await supabase
    .from('invoices')
    .select('id, invoice_number')
    .eq('id', id)
    .single()

  if (fetchError || !existing) return { data: null, error: 'Invoice not found' }

  if (!formData.client_id) return { data: null, error: 'Client is required' }
  const items = Array.isArray(formData.items) ? formData.items : []
  if (items.length === 0) return { data: null, error: 'Add at least one item' }

  const invoice_type = (formData.invoice_type || 'gst') as InvoiceType
  if (!['gst', 'non_gst'].includes(invoice_type)) {
    return { data: null, error: 'Invalid invoice type' }
  }

  const derived = await deriveGstTaxTypeForClient(supabase, formData.client_id, invoice_type)
  if (derived.error) return { data: null, error: derived.error }

  const discount = normalizeNumber(formData.discount)
  const totals = calcTotals({
    invoice_type,
    gst_tax_type: derived.gst_tax_type,
    items,
    discount,
  })

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      invoice_date: formData.invoice_date || undefined,
      client_id: formData.client_id,
      invoice_type,
      gst_tax_type: totals.gst.gst_tax_type,
      subtotal: totals.subtotal,
      discount: totals.discount,
      cgst_rate: totals.gst.cgst_rate,
      cgst_amount: totals.gst.cgst_amount,
      sgst_rate: totals.gst.sgst_rate,
      sgst_amount: totals.gst.sgst_amount,
      igst_rate: totals.gst.igst_rate,
      igst_amount: totals.gst.igst_amount,
      total_tax: totals.gst.total_tax,
      grand_total: totals.grand_total,
      terms_and_conditions: formData.terms_and_conditions?.trim() || null,
    } as never)
    .eq('id', id)

  if (updateError) {
    console.error('Error updating invoice:', updateError)
    return { data: null, error: updateError.message ?? 'Failed to update invoice' }
  }

  await supabase.from('invoice_items').delete().eq('invoice_id', id)
  const itemRows = items.map((i) => ({
    invoice_id: id,
    project_id: i.project_id || null,
    narration: i.narration?.trim() || null,
    amount: Math.max(0, normalizeNumber(i.amount)),
    created_by: currentUser.id,
  }))
  const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows as never)
  if (itemsError) {
    console.error('Error updating invoice items:', itemsError)
    return { data: null, error: itemsError.message ?? 'Failed to update invoice items' }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Update',
    moduleName: 'Invoices',
    recordId: id,
    description: `Updated invoice ${(existing as { invoice_number: string }).invoice_number}`,
    status: 'Success',
  })

  revalidatePath('/dashboard/invoices')
  revalidatePath(`/dashboard/invoices/${id}`)
  return getInvoice(id)
}

export async function deleteInvoice(id: string): Promise<{ error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: 'You must be logged in to delete an invoice' }
  if (currentUser.role !== 'admin') return { error: 'Only administrators can delete invoices' }

  const supabase = await createClient()
  const { data: existing } = await supabase.from('invoices').select('id, invoice_number').eq('id', id).single()
  if (!existing) return { error: 'Invoice not found' }

  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) {
    console.error('Error deleting invoice:', error)
    return { error: error.message ?? 'Failed to delete invoice' }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Delete',
    moduleName: 'Invoices',
    recordId: id,
    description: `Deleted invoice ${(existing as { invoice_number: string }).invoice_number}`,
    status: 'Success',
  })

  revalidatePath('/dashboard/invoices')
  return { error: null }
}

export async function getProjectsForInvoiceItemsSelect(): Promise<{
  data: Array<{ id: string; name: string }> 
  error: string | null
}> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { data: [], error: 'You must be logged in' }
  const canWriteInvoices = await hasPermission(currentUser, MODULE_PERMISSION_IDS.invoices, 'write')
  if (!canWriteInvoices) return { data: [], error: 'You do not have permission' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name', { ascending: true })
    .limit(500)

  if (error) {
    console.error('Error fetching projects for invoice select:', error)
    return { data: [], error: error.message || 'Failed to fetch projects' }
  }
  return { data: (data as Array<{ id: string; name: string }> | null) ?? [], error: null }
}

