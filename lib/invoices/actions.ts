'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { prepareSearchTerm } from '@/lib/supabase/utils'
import { createActivityLogEntry } from '@/lib/activity-log/logger'
import { invoiceLineAmount } from '@/lib/invoices/line-amount'

export type InvoiceType = 'gst' | 'non_gst'
export type InvoiceGstTaxType = 'cgst_sgst' | 'igst' | 'none'
export type InvoicePaymentStatus = 'unpaid' | 'paid' | 'partial_paid'

export type InvoiceItemFormData = {
  project_id?: string | null
  /** SAC/HSN per line; required for each line on GST invoices */
  hsn_code_id?: string | null
  narration?: string | null
  quantity: number
  rate: number
  /** Line total (qty × rate), rounded; stored and used for invoice subtotal */
  amount: number
}

export type InvoiceFormData = {
  client_id: string
  invoice_date?: string
  invoice_type: InvoiceType
  /** Create: if set and non-empty, used as invoice number (must be unique). If empty, server assigns next SCC/FY/seq. Update: required; must be unique among other invoices. */
  invoice_number?: string
  discount?: number
  terms_and_conditions?: string
  items: InvoiceItemFormData[]
}

export type HsnCodeOption = {
  id: string
  code: string
  title: string
  description: string
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
  hsn_code: string | null
  hsn_title: string | null
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
  paid_amount: number
  terms_and_conditions: string | null
  payment_status: InvoicePaymentStatus
  created_by: string
  created_at: string
  updated_at: string
  client?: {
    id: string
    name: string
    company_name: string | null
    phone?: string | null
    email?: string | null
    gst_number?: string | null
  } | null
  items?: Array<{
    id: string
    invoice_id: string
    project_id: string | null
    hsn_code_id: string | null
    project_name?: string | null
    hsn_code?: { code: string; title: string; description?: string } | null
    narration: string | null
    quantity: number
    rate: number
    amount: number
    created_at: string
  }>
}

export type GetInvoicesPageOptions = {
  search?: string
  status?: InvoicePaymentStatus | 'all'
  /** When set to a valid client UUID, only invoices for that client are returned. */
  clientId?: string
  sortField?: 'invoice_number' | 'invoice_date' | 'grand_total' | 'payment_status' | 'created_at'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

const INVOICE_NUMBER_PREFIX: Record<InvoiceType, string> = {
  gst: 'SCC',
  non_gst: 'CHL',
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeNumber(value?: number | string | null): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeOptionalUuid(value?: string | null): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

const CLIENT_ID_FILTER_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseClientIdFilter(raw?: string | null): string | null {
  const s = raw?.trim()
  if (!s) return null
  return CLIENT_ID_FILTER_RE.test(s) ? s : null
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

function getInvoiceNumberPrefix(invoiceType: InvoiceType, financialYear: string): string {
  return `${INVOICE_NUMBER_PREFIX[invoiceType]}/${financialYear}/`
}

/** Next invoice/challan number for the financial year of `invoiceDate` (or today), without inserting. */
export async function getNextInvoiceNumber(
  invoiceType: InvoiceType = 'gst',
  invoiceDate?: string | null
): Promise<{ data: string | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { data: null, error: 'You must be logged in' }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.invoices, 'read')
  if (!canRead) return { data: null, error: 'You do not have permission to view invoices' }

  const supabase = await createClient()
  const next = await generateInvoiceNumber(supabase, invoiceType, invoiceDate ?? null)
  return { data: next, error: null }
}

async function generateInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceType: InvoiceType,
  invoiceDate: string | null
): Promise<string> {
  const d = invoiceDate ? new Date(`${invoiceDate}T00:00:00.000Z`) : new Date()
  const fy = getFinancialYearLabel(d)
  const prefix = getInvoiceNumberPrefix(invoiceType, fy)

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

async function assertLineItemsHsnValid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceType: InvoiceType,
  items: InvoiceItemFormData[]
): Promise<{ error: string | null }> {
  if (invoiceType !== 'gst') return { error: null }
  const ids: string[] = []
  for (let i = 0; i < items.length; i++) {
    const id = normalizeOptionalUuid(items[i].hsn_code_id)
    if (!id) {
      return { error: `Row ${i + 1}: HSN code is required for GST invoices` }
    }
    ids.push(id)
  }
  const unique = [...new Set(ids)]
  const { data, error } = await supabase.from('hsn_codes').select('id').in('id', unique)
  if (error) return { error: error.message ?? 'Failed to validate HSN codes' }
  if ((data?.length ?? 0) !== unique.length) {
    return { error: 'One or more HSN selections are invalid' }
  }
  return { error: null }
}

function summarizeInvoiceLineHsns(
  invoiceItems: Array<{
    hsn_codes?: { code: string; title: string } | { code: string; title: string }[] | null
  }>
): { hsn_code: string | null; hsn_title: string | null } {
  const pairs: { code: string; title: string }[] = []
  for (const row of invoiceItems) {
    const h = Array.isArray(row.hsn_codes) ? row.hsn_codes[0] : row.hsn_codes
    if (h?.code) pairs.push({ code: h.code, title: h.title || '' })
  }
  if (pairs.length === 0) return { hsn_code: null, hsn_title: null }
  const codes = [...new Set(pairs.map((p) => p.code))]
  const titles = pairs.map((p) => p.title).filter(Boolean)
  const uniqueTitles = [...new Set(titles)]
  return {
    hsn_code: codes.join(', '),
    hsn_title:
      uniqueTitles.length <= 1
        ? uniqueTitles[0] ?? null
        : `${uniqueTitles.slice(0, 2).join(' · ')}${uniqueTitles.length > 2 ? '…' : ''}`,
  }
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
    (input.items || []).reduce(
      (sum, item) => sum + invoiceLineAmount(item.quantity, item.rate),
      0
    )
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
    .select(
      'id, invoice_number, invoice_date, client_id, grand_total, payment_status, created_at, clients(id,name), invoice_items(hsn_codes(code,title))',
      {
        count: 'exact',
      }
    )

  if (searchTerm) {
    query = query.or(`invoice_number.ilike.%${searchTerm}%`)
  }
  if (options.status && options.status !== 'all') {
    query = query.eq('payment_status', options.status)
  }

  const clientIdFilter = parseClientIdFilter(options.clientId)
  if (clientIdFilter) {
    query = query.eq('client_id', clientIdFilter)
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
    invoice_items: Array<{ hsn_codes?: { code: string; title: string } | { code: string; title: string }[] | null }> | null
    clients: { id: string; name: string } | { id: string; name: string }[] | null
  }>

  const list: InvoiceListItem[] = rows.map((r) => {
    const client = Array.isArray(r.clients) ? r.clients[0] : r.clients
    const lineItems = Array.isArray(r.invoice_items) ? r.invoice_items : []
    const { hsn_code, hsn_title } = summarizeInvoiceLineHsns(lineItems)
    return {
      id: r.id,
      invoice_number: r.invoice_number,
      invoice_date: r.invoice_date,
      client_id: r.client_id,
      client_name: client?.name ?? '—',
      grand_total: r.grand_total,
      payment_status: (r.payment_status || 'unpaid') as InvoicePaymentStatus,
      created_at: r.created_at,
      hsn_code,
      hsn_title,
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
    .select('*, clients(id,name,company_name,phone,email,gst_number)')
    .eq('id', id)
    .single()

  if (error || !data) {
    return { data: null, error: error?.message ?? 'Invoice not found' }
  }

  const invoiceRow = data as Invoice & {
    clients?: Invoice['client'] | Invoice['client'][]
  }
  const client = Array.isArray(invoiceRow.clients) ? invoiceRow.clients[0] : invoiceRow.clients

  const { data: itemRows } = await supabase
    .from('invoice_items')
    .select(
      'id, invoice_id, project_id, hsn_code_id, narration, quantity, rate, amount, created_at, projects(name), hsn_codes(code,title,description)'
    )
    .eq('invoice_id', id)
    .order('created_at', { ascending: true })

  const items = ((itemRows as any[]) || []).map((r) => {
    const hsnRow = Array.isArray(r.hsn_codes) ? r.hsn_codes[0] : r.hsn_codes
    return {
      id: r.id,
      invoice_id: r.invoice_id,
      project_id: r.project_id ?? null,
      hsn_code_id: r.hsn_code_id ?? null,
      project_name: Array.isArray(r.projects) ? r.projects[0]?.name ?? null : r.projects?.name ?? null,
      hsn_code: hsnRow
        ? { code: hsnRow.code, title: hsnRow.title, description: hsnRow.description }
        : null,
      narration: r.narration ?? null,
      quantity: Number(r.quantity ?? 1),
      rate: Number(r.rate ?? 0),
      amount: Number(r.amount ?? 0),
      created_at: r.created_at,
    }
  })

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
  const invoice_type = (formData.invoice_type || 'gst') as InvoiceType
  if (!['gst', 'non_gst'].includes(invoice_type)) {
    return { data: null, error: 'Invalid invoice type' }
  }

  const requestedNumber = formData.invoice_number?.trim() ?? ''
  let invoice_number: string
  if (requestedNumber) {
    const { data: clash } = await supabase.from('invoices').select('id').eq('invoice_number', requestedNumber).maybeSingle()
    if (clash) {
      return {
        data: null,
        error: 'This invoice number is already in use. Enter a different number or clear the field to auto-assign the next one.',
      }
    }
    invoice_number = requestedNumber
  } else {
    invoice_number = await generateInvoiceNumber(supabase, invoice_type, invoice_date)
  }

  const derived = await deriveGstTaxTypeForClient(supabase, formData.client_id, invoice_type)
  if (derived.error) return { data: null, error: derived.error }

  const hsnCheck = await assertLineItemsHsnValid(supabase, invoice_type, items)
  if (hsnCheck.error) return { data: null, error: hsnCheck.error }

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
  const itemRows = items.map((i) => {
    const quantity = Math.max(0, normalizeNumber(i.quantity))
    const rate = Math.max(0, normalizeNumber(i.rate))
    const amount = invoiceLineAmount(quantity, rate)
    return {
      invoice_id: invoiceId,
      project_id: i.project_id || null,
      hsn_code_id: invoice_type === 'gst' ? normalizeOptionalUuid(i.hsn_code_id) : null,
      narration: i.narration?.trim() || null,
      quantity,
      rate,
      amount,
      created_by: currentUser.id,
    }
  })

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

type InvoiceRowSnapshot = {
  id: string
  invoice_number: string
  invoice_date: string
  client_id: string
  invoice_type: string
  gst_tax_type: string
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
    .select(
      'id, invoice_number, invoice_date, client_id, invoice_type, gst_tax_type, subtotal, discount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total_tax, grand_total, terms_and_conditions'
    )
    .eq('id', id)
    .single()

  if (fetchError || !existing) return { data: null, error: 'Invoice not found' }

  const snapshot = existing as unknown as InvoiceRowSnapshot

  const { data: previousItemRows } = await supabase
    .from('invoice_items')
    .select('project_id, hsn_code_id, narration, quantity, rate, amount')
    .eq('invoice_id', id)

  const previousItems =
    (previousItemRows as Array<{
      project_id: string | null
      hsn_code_id: string | null
      narration: string | null
      quantity: number
      rate: number
      amount: number
    }> | null) ?? []

  if (!formData.client_id) return { data: null, error: 'Client is required' }
  const items = Array.isArray(formData.items) ? formData.items : []
  if (items.length === 0) return { data: null, error: 'Add at least one item' }

  const invoice_type = (formData.invoice_type || 'gst') as InvoiceType
  if (!['gst', 'non_gst'].includes(invoice_type)) {
    return { data: null, error: 'Invalid invoice type' }
  }

  const derived = await deriveGstTaxTypeForClient(supabase, formData.client_id, invoice_type)
  if (derived.error) return { data: null, error: derived.error }

  const hsnCheck = await assertLineItemsHsnValid(supabase, invoice_type, items)
  if (hsnCheck.error) return { data: null, error: hsnCheck.error }

  const discount = normalizeNumber(formData.discount)
  const totals = calcTotals({
    invoice_type,
    gst_tax_type: derived.gst_tax_type,
    items,
    discount,
  })

  const requestedNumber = formData.invoice_number?.trim() ?? ''
  if (!requestedNumber) {
    return { data: null, error: 'Invoice number is required' }
  }
  if (requestedNumber !== snapshot.invoice_number) {
    const { data: clash } = await supabase
      .from('invoices')
      .select('id')
      .eq('invoice_number', requestedNumber)
      .neq('id', id)
      .maybeSingle()
    if (clash) {
      return {
        data: null,
        error: 'This invoice number is already in use. Enter a different number.',
      }
    }
  }

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      invoice_number: requestedNumber,
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
  const itemRows = items.map((i) => {
    const quantity = Math.max(0, normalizeNumber(i.quantity))
    const rate = Math.max(0, normalizeNumber(i.rate))
    const amount = invoiceLineAmount(quantity, rate)
    return {
      invoice_id: id,
      project_id: i.project_id || null,
      hsn_code_id: invoice_type === 'gst' ? normalizeOptionalUuid(i.hsn_code_id) : null,
      narration: i.narration?.trim() || null,
      quantity,
      rate,
      amount,
      created_by: currentUser.id,
    }
  })
  const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows as never)
  if (itemsError) {
    console.error('Error updating invoice items:', itemsError)
    // Restore header + line items so we never leave an invoice with zero rows after a failed replace.
    await supabase
      .from('invoices')
      .update({
        invoice_number: snapshot.invoice_number,
        invoice_date: snapshot.invoice_date,
        client_id: snapshot.client_id,
        invoice_type: snapshot.invoice_type,
        gst_tax_type: snapshot.gst_tax_type,
        subtotal: snapshot.subtotal,
        discount: snapshot.discount,
        cgst_rate: snapshot.cgst_rate,
        cgst_amount: snapshot.cgst_amount,
        sgst_rate: snapshot.sgst_rate,
        sgst_amount: snapshot.sgst_amount,
        igst_rate: snapshot.igst_rate,
        igst_amount: snapshot.igst_amount,
        total_tax: snapshot.total_tax,
        grand_total: snapshot.grand_total,
        terms_and_conditions: snapshot.terms_and_conditions,
      } as never)
      .eq('id', id)

    const restoreRows = previousItems.map((r) => ({
      invoice_id: id,
      project_id: r.project_id,
      hsn_code_id: r.hsn_code_id,
      narration: r.narration,
      quantity: Math.max(0, normalizeNumber(r.quantity)),
      rate: Math.max(0, normalizeNumber(r.rate)),
      amount: Math.max(0, normalizeNumber(r.amount)),
      created_by: currentUser.id,
    }))
    if (restoreRows.length > 0) {
      await supabase.from('invoice_items').insert(restoreRows as never)
    }
    return { data: null, error: itemsError.message ?? 'Failed to update invoice items' }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Update',
    moduleName: 'Invoices',
    recordId: id,
    description: `Updated invoice ${requestedNumber}`,
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

export async function getHsnCodesForSelect(): Promise<{ data: HsnCodeOption[]; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { data: [], error: 'You must be logged in' }
  const canReadInvoices = await hasPermission(currentUser, MODULE_PERMISSION_IDS.invoices, 'read')
  if (!canReadInvoices) return { data: [], error: 'You do not have permission' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hsn_codes')
    .select('id, code, title, description')
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true })

  if (error) {
    console.error('Error fetching HSN codes:', error)
    return { data: [], error: error.message || 'Failed to fetch HSN codes' }
  }
  return { data: (data as HsnCodeOption[] | null) ?? [], error: null }
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
