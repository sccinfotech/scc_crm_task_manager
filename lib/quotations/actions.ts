'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { encryptAmount, decryptAmount } from '@/lib/amount-encryption'
import { createActivityLogEntry } from '@/lib/activity-log/logger'
import { createClient as createClientRecord } from '@/lib/clients/actions'
import type { ClientFormData } from '@/lib/clients/actions'
import { getLead, updateLead } from '@/lib/leads/actions'
import { prepareSearchTerm } from '@/lib/supabase/utils'

export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'under_discussion'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'converted'

export type QuotationSourceType = 'lead' | 'client'

export type QuotationFormData = {
  source_type: QuotationSourceType
  lead_id?: string
  client_id?: string
  valid_till?: string
  technology_tool_ids?: string[]
  reference?: string
  status: QuotationStatus
  discount?: number
}

export type Quotation = {
  id: string
  quotation_number: string
  source_type: QuotationSourceType
  lead_id: string | null
  client_id: string | null
  valid_till: string | null
  subtotal: number
  discount: number
  final_total: number
  status: QuotationStatus
  reference: string | null
  created_by: string
  created_at: string
  updated_at: string
  client_snapshot_name: string | null
  client_snapshot_company_name: string | null
  client_snapshot_phone: string | null
  client_snapshot_email: string | null
  client_snapshot_remark: string | null
  lead?: { id: string; name: string; company_name: string | null; phone: string } | null
  client?: { id: string; name: string; company_name: string | null; phone: string } | null
  technology_tools?: { id: string; name: string }[]
}

export type QuotationListItem = {
  id: string
  quotation_number: string
  source_type: QuotationSourceType
  lead_id: string | null
  client_id: string | null
  source_name: string
  technology_tools_display: string
  final_total: number
  status: QuotationStatus
  valid_till: string | null
  created_at: string
}

export type QuotationRequirementType = 'initial' | 'addon'
export type QuotationPricingType = 'hourly' | 'fixed' | 'milestone'

export type QuotationRequirement = {
  id: string
  quotation_id: string
  requirement_type: QuotationRequirementType
  pricing_type: QuotationPricingType
  title: string | null
  description: string | null
  attachment_url: string | null
  estimated_hours: number | null
  hourly_rate: number | null
  amount: number | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
  milestones?: QuotationRequirementMilestone[]
}

export type QuotationRequirementMilestone = {
  id: string
  requirement_id: string
  quotation_id: string
  title: string
  description: string | null
  due_date: string | null
  amount: number
  created_by: string
  created_at: string
  updated_at: string
}

export type QuotationRequirementFormData = {
  requirement_type?: QuotationRequirementType
  pricing_type?: QuotationPricingType
  title?: string | null
  description?: string | null
  attachment_url?: string | null
  estimated_hours?: number | null
  hourly_rate?: number | null
  amount?: number | null
  milestones?: { title: string; description?: string | null; due_date?: string | null; amount: number | null }[]
}

export type GetQuotationsPageOptions = {
  search?: string
  status?: QuotationStatus | 'all'
  source_type?: QuotationSourceType | 'all'
  technology_tool_ids?: string[]
  date_from?: string
  date_to?: string
  sortField?: 'quotation_number' | 'valid_till' | 'final_total' | 'status' | 'created_at'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export type QuotationActionResult = { data: Quotation | null; error: string | null }
export type QuotationListResult = { data: QuotationListItem[]; totalCount: number; error: string | null }
export type QuotationRequirementActionResult = { data: QuotationRequirement | null; error: string | null }
export type QuotationRequirementsResult = {
  data: QuotationRequirement[]
  subtotal: number
  discount: number
  final_total: number
  error: string | null
}
export type StartConversionResult = {
  client_id: string
  quotation: Quotation
  error: string | null
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeNumber(value?: number | string | null): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

async function generateQuotationNumber(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `Q-${year}-`
  const { data } = await supabase
    .from('quotations')
    .select('quotation_number')
    .like('quotation_number', `${prefix}%`)
    .order('quotation_number', { ascending: false })
    .limit(1)
  const last = (data as { quotation_number: string }[] | null)?.[0]
  let next = 1
  if (last?.quotation_number?.startsWith(prefix)) {
    const num = Number.parseInt(last.quotation_number.slice(prefix.length), 10)
    if (Number.isFinite(num)) next = num + 1
  }
  return `${prefix}${String(next).padStart(4, '0')}`
}

export async function getQuotationsPage(
  options: GetQuotationsPageOptions = {}
): Promise<QuotationListResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: [], totalCount: 0, error: 'You must be logged in to view quotations' }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.quotations, 'read')
  if (!canRead) {
    return { data: [], totalCount: 0, error: 'You do not have permission to view quotations' }
  }

  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  const supabase = await createClient()

  let query = supabase
    .from('quotations')
    .select(
      'id, quotation_number, source_type, lead_id, client_id, final_total, status, valid_till, created_at, leads(id,name,company_name,phone), clients(id,name,company_name,phone)',
      { count: 'exact' }
    )

  const searchTerm = prepareSearchTerm(options.search)
  if (searchTerm) {
    query = query.or(`quotation_number.ilike.%${searchTerm}%,reference.ilike.%${searchTerm}%`)
  }
  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }
  if (options.source_type && options.source_type !== 'all') {
    query = query.eq('source_type', options.source_type)
  }
  if (options.date_from) {
    query = query.gte('created_at', `${options.date_from}T00:00:00.000Z`)
  }
  if (options.date_to) {
    query = query.lte('created_at', `${options.date_to}T23:59:59.999Z`)
  }

  const sortField = options.sortField ?? 'created_at'
  const sortDirection = options.sortDirection ?? 'desc'
  query = query.order(sortField, { ascending: sortDirection === 'asc' })

  if (options.technology_tool_ids?.length) {
    const { data: qtt } = await supabase
      .from('quotation_technology_tools')
      .select('quotation_id')
      .in('technology_tool_id', options.technology_tool_ids)
    const quotationIds = [...new Set((qtt || []).map((r: { quotation_id: string }) => r.quotation_id))]
    if (quotationIds.length === 0) {
      return { data: [], totalCount: 0, error: null }
    }
    query = query.in('id', quotationIds)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Error fetching quotations:', error)
    return { data: [], totalCount: 0, error: error.message }
  }

  type LeadClient = { id: string; name: string; company_name: string | null; phone: string }
  const rows = (data || []) as Array<{
    id: string
    quotation_number: string
    source_type: string
    lead_id: string | null
    client_id: string | null
    final_total: number
    status: string
    valid_till: string | null
    created_at: string
    leads: LeadClient | LeadClient[] | null
    clients: LeadClient | LeadClient[] | null
  }>

  const { data: toolData } = await supabase
    .from('quotation_technology_tools')
    .select('quotation_id, technology_tools(name)')
    .in('quotation_id', rows.map((r) => r.id))

  const toolsByQuotation = new Map<string, string[]>()
  ;(toolData as Array<{ quotation_id: string; technology_tools: { name: string } | null }> | null)?.forEach(
    (row) => {
      const list = toolsByQuotation.get(row.quotation_id) || []
      if (row.technology_tools?.name) list.push(row.technology_tools.name)
      toolsByQuotation.set(row.quotation_id, list)
    }
  )

  const list: QuotationListItem[] = rows.map((r) => {
    const lead = Array.isArray(r.leads) ? r.leads[0] : r.leads
    const client = Array.isArray(r.clients) ? r.clients[0] : r.clients
    const sourceName =
      r.source_type === 'lead'
        ? lead?.name ?? (lead ? `${lead.company_name || ''} ${lead.phone}`.trim() || '—' : '—')
        : client?.name ?? (client ? `${client.company_name || ''} ${client.phone}`.trim() || '—' : '—')
    return {
      id: r.id,
      quotation_number: r.quotation_number,
      source_type: r.source_type as QuotationSourceType,
      lead_id: r.lead_id,
      client_id: r.client_id,
      source_name: sourceName,
      technology_tools_display: (toolsByQuotation.get(r.id) || []).join(', ') || '—',
      final_total: r.final_total,
      status: r.status as QuotationStatus,
      valid_till: r.valid_till,
      created_at: r.created_at,
    }
  })

  return { data: list, totalCount: count ?? 0, error: null }
}

export async function getQuotation(id: string): Promise<QuotationActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to view quotations' }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.quotations, 'read')
  if (!canRead) {
    return { data: null, error: 'You do not have permission to view quotations' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quotations')
    .select('*, leads(id,name,company_name,phone), clients(id,name,company_name,phone)')
    .eq('id', id)
    .single()

  if (error || !data) {
    return { data: null, error: error?.message ?? 'Quotation not found' }
  }

  type Rel = { id: string; name: string; company_name: string | null; phone: string } | null
  const row = data as Quotation & { leads?: Rel | Rel[]; clients?: Rel | Rel[] }
  const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients
  const { data: toolRows } = await supabase
    .from('quotation_technology_tools')
    .select('technology_tools(id, name)')
    .eq('quotation_id', id)
  const technology_tools = (toolRows as Array<{ technology_tools: { id: string; name: string } | null }> | null)
    ?.map((r) => r.technology_tools)
    .filter(Boolean) as { id: string; name: string }[] | undefined

  const { leads: _leads, clients: _clients, ...rest } = row
  const quotation: Quotation = {
    ...rest,
    lead: lead ?? undefined,
    client: client ?? undefined,
    technology_tools,
  }
  return { data: quotation, error: null }
}

export async function createQuotation(formData: QuotationFormData): Promise<QuotationActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to create a quotation' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.quotations, 'write')
  if (!canWrite) {
    return { data: null, error: 'You do not have permission to create quotations' }
  }

  if (!formData.source_type) {
    return { data: null, error: 'Source type is required' }
  }
  if (formData.source_type === 'lead' && !formData.lead_id) {
    return { data: null, error: 'Lead is required when source is Lead' }
  }
  if (formData.source_type === 'client' && !formData.client_id) {
    return { data: null, error: 'Client is required when source is Client' }
  }

  const supabase = await createClient()
  const quotation_number = await generateQuotationNumber(supabase)
  const discount = Math.max(0, normalizeNumber(formData.discount) ?? 0)
  const status = (formData.status || 'draft') as QuotationStatus
  const validStatuses: QuotationStatus[] = [
    'draft',
    'sent',
    'under_discussion',
    'approved',
    'rejected',
    'expired',
    'converted',
  ]
  if (!validStatuses.includes(status)) {
    return { data: null, error: 'Invalid status' }
  }

  let client_snapshot_name: string | null = null
  let client_snapshot_company_name: string | null = null
  let client_snapshot_phone: string | null = null
  let client_snapshot_email: string | null = null
  let client_snapshot_remark: string | null = null
  if (formData.source_type === 'lead' && formData.lead_id) {
    const { data: lead } = await getLead(formData.lead_id)
    if (lead?.data) {
      client_snapshot_name = lead.data.name?.trim() || null
      client_snapshot_company_name = lead.data.company_name?.trim() || null
      client_snapshot_phone = lead.data.phone?.trim() || null
      client_snapshot_remark = lead.data.notes?.trim() || null
    }
  }

  const { data: inserted, error } = await supabase
    .from('quotations')
    .insert({
      quotation_number,
      source_type: formData.source_type,
      lead_id: formData.source_type === 'lead' ? formData.lead_id : null,
      client_id: formData.source_type === 'client' ? formData.client_id : null,
      valid_till: formData.valid_till || null,
      subtotal: 0,
      discount,
      final_total: 0,
      status,
      reference: formData.reference?.trim() || null,
      created_by: currentUser.id,
      client_snapshot_name,
      client_snapshot_company_name,
      client_snapshot_phone,
      client_snapshot_email,
      client_snapshot_remark,
    } as never)
    .select()
    .single()

  if (error) {
    console.error('Error creating quotation:', error)
    return { data: null, error: error.message }
  }

  const quotationId = (inserted as { id: string }).id
  const toolIds = Array.from(new Set(formData.technology_tool_ids ?? [])).filter(Boolean)
  if (toolIds.length > 0) {
    const toolRows = toolIds.map((toolId) => ({
      quotation_id: quotationId,
      technology_tool_id: toolId,
      created_by: currentUser.id,
    }))
    await supabase.from('quotation_technology_tools').insert(toolRows as never)
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Create',
    moduleName: 'Quotations',
    recordId: quotationId,
    description: `Created quotation ${quotation_number}`,
    status: 'Success',
  })

  revalidatePath('/dashboard/quotations')
  return getQuotation(quotationId)
}

export async function updateQuotation(
  id: string,
  formData: QuotationFormData
): Promise<QuotationActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update a quotation' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.quotations, 'write')
  if (!canWrite) {
    return { data: null, error: 'You do not have permission to update quotations' }
  }

  const supabase = await createClient()
  const { data: existing, error: fetchError } = await supabase
    .from('quotations')
    .select('id, status')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return { data: null, error: 'Quotation not found' }
  }

  const row = existing as { id: string; status: string }
  if (row.status === 'converted') {
    return { data: null, error: 'Converted quotation cannot be edited' }
  }

  if (!formData.source_type) {
    return { data: null, error: 'Source type is required' }
  }
  if (formData.source_type === 'lead' && !formData.lead_id) {
    return { data: null, error: 'Lead is required when source is Lead' }
  }
  if (formData.source_type === 'client' && !formData.client_id) {
    return { data: null, error: 'Client is required when source is Client' }
  }

  const discount = Math.max(0, normalizeNumber(formData.discount) ?? 0)
  const { data: reqs } = await supabase
    .from('quotation_requirements')
    .select('id, amount')
    .eq('quotation_id', id)
  const amounts = (reqs || []) as Array<{ amount: string | null }>
  let subtotal = 0
  for (const r of amounts) {
    const dec = r.amount ? decryptAmount(r.amount) : null
    if (dec !== null) subtotal += dec
  }
  subtotal = roundCurrency(subtotal)
  const final_total = roundCurrency(Math.max(0, subtotal - discount))

  let client_snapshot_name: string | null = null
  let client_snapshot_company_name: string | null = null
  let client_snapshot_phone: string | null = null
  let client_snapshot_email: string | null = null
  let client_snapshot_remark: string | null = null
  if (formData.source_type === 'lead' && formData.lead_id) {
    const { data: lead } = await getLead(formData.lead_id)
    if (lead?.data) {
      client_snapshot_name = lead.data.name?.trim() || null
      client_snapshot_company_name = lead.data.company_name?.trim() || null
      client_snapshot_phone = lead.data.phone?.trim() || null
      client_snapshot_remark = lead.data.notes?.trim() || null
    }
  }

  const { error: updateError } = await supabase
    .from('quotations')
    .update({
      source_type: formData.source_type,
      lead_id: formData.source_type === 'lead' ? formData.lead_id : null,
      client_id: formData.source_type === 'client' ? formData.client_id : null,
      valid_till: formData.valid_till || null,
      discount,
      subtotal,
      final_total,
      status: formData.status || row.status,
      reference: formData.reference?.trim() || null,
      client_snapshot_name,
      client_snapshot_company_name,
      client_snapshot_phone,
      client_snapshot_email,
      client_snapshot_remark,
    } as never)
    .eq('id', id)

  if (updateError) {
    console.error('Error updating quotation:', updateError)
    return { data: null, error: updateError.message }
  }

  await supabase.from('quotation_technology_tools').delete().eq('quotation_id', id)
  const toolIds = Array.from(new Set(formData.technology_tool_ids ?? [])).filter(Boolean)
  if (toolIds.length > 0) {
    const toolRows = toolIds.map((toolId) => ({
      quotation_id: id,
      technology_tool_id: toolId,
      created_by: currentUser.id,
    }))
    await supabase.from('quotation_technology_tools').insert(toolRows as never)
  }

  revalidatePath('/dashboard/quotations')
  revalidatePath(`/dashboard/quotations/${id}`)
  return getQuotation(id)
}

export async function deleteQuotation(id: string): Promise<{ error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'You must be logged in to delete a quotation' }
  }
  if (currentUser.role !== 'admin') {
    return { error: 'Only administrators can delete quotations' }
  }
  const supabase = await createClient()
  const { data: existing } = await supabase.from('quotations').select('id, status').eq('id', id).single()
  if (!existing) {
    return { error: 'Quotation not found' }
  }
  const status = (existing as { status: string }).status
  if (status === 'converted') {
    return { error: 'Converted quotation cannot be deleted' }
  }

  const { error } = await supabase.from('quotations').delete().eq('id', id)
  if (error) {
    console.error('Error deleting quotation:', error)
    return { error: error.message }
  }
  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Delete',
    moduleName: 'Quotations',
    recordId: id,
    description: 'Deleted quotation',
    status: 'Success',
  })
  revalidatePath('/dashboard/quotations')
  return { error: null }
}

export async function changeQuotationStatus(
  id: string,
  newStatus: QuotationStatus
): Promise<QuotationActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to change quotation status' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.quotations, 'write')
  if (!canWrite) {
    return { data: null, error: 'You do not have permission to update quotations' }
  }

  const validStatuses: QuotationStatus[] = [
    'draft',
    'sent',
    'under_discussion',
    'approved',
    'rejected',
    'expired',
    'converted',
  ]
  if (!validStatuses.includes(newStatus)) {
    return { data: null, error: 'Invalid status' }
  }

  const supabase = await createClient()
  const { data: existing, error: fetchError } = await supabase
    .from('quotations')
    .select('id, status')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return { data: null, error: 'Quotation not found' }
  }

  const currentStatus = (existing as { status: string }).status
  if (currentStatus === 'converted') {
    return { data: null, error: 'Converted quotation cannot be modified' }
  }

  if (newStatus === 'approved') {
    const { data: reqs } = await supabase
      .from('quotation_requirements')
      .select('id')
      .eq('quotation_id', id)
    if (!(reqs && (reqs as unknown[]).length > 0)) {
      return { data: null, error: 'At least one requirement must exist before approving' }
    }
  }

  const { error: updateError } = await supabase
    .from('quotations')
    .update({ status: newStatus } as never)
    .eq('id', id)

  if (updateError) {
    return { data: null, error: updateError.message }
  }

  revalidatePath('/dashboard/quotations')
  revalidatePath(`/dashboard/quotations/${id}`)
  return getQuotation(id)
}

// ---------- Quotation requirements ----------

async function recalcQuotationTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quotationId: string
): Promise<{ subtotal: number; discount: number; final_total: number }> {
  const { data: reqs } = await supabase
    .from('quotation_requirements')
    .select('amount')
    .eq('quotation_id', quotationId)
  let subtotal = 0
  for (const r of (reqs || []) as Array<{ amount: string | null }>) {
    const dec = r.amount ? decryptAmount(r.amount) : null
    if (dec !== null) subtotal += dec
  }
  subtotal = roundCurrency(subtotal)
  const { data: q } = await supabase
    .from('quotations')
    .select('discount')
    .eq('id', quotationId)
    .single()
  const discount = (q as { discount: number } | null)?.discount ?? 0
  const final_total = roundCurrency(Math.max(0, subtotal - discount))
  await supabase
    .from('quotations')
    .update({ subtotal, final_total } as never)
    .eq('id', quotationId)
  return { subtotal, discount, final_total }
}

export async function getQuotationRequirements(quotationId: string): Promise<QuotationRequirementsResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: [], subtotal: 0, discount: 0, final_total: 0, error: 'You must be logged in' }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.quotations, 'read')
  if (!canRead) {
    return { data: [], subtotal: 0, discount: 0, final_total: 0, error: 'No permission' }
  }

  const supabase = await createClient()
  const { data: requirements, error } = await supabase
    .from('quotation_requirements')
    .select(
      'id, quotation_id, requirement_type, pricing_type, title, description, attachment_url, estimated_hours, hourly_rate, amount, created_by, created_at, updated_at'
    )
    .eq('quotation_id', quotationId)
    .order('created_at', { ascending: true })

  if (error) {
    return { data: [], subtotal: 0, discount: 0, final_total: 0, error: error.message }
  }

  const rows = (requirements || []) as Array<{
    id: string
    quotation_id: string
    requirement_type: string
    pricing_type: string
    title: string | null
    description: string | null
    attachment_url: string | null
    estimated_hours: number | string | null
    hourly_rate: string | null
    amount: string | null
    created_by: string
    created_at: string
    updated_at: string
  }>
  if (rows.length === 0) {
    const { data: q } = await supabase.from('quotations').select('subtotal, discount, final_total').eq('id', quotationId).single()
    const qq = q as { subtotal: number; discount: number; final_total: number } | null
    return {
      data: [],
      subtotal: qq?.subtotal ?? 0,
      discount: qq?.discount ?? 0,
      final_total: qq?.final_total ?? 0,
      error: null,
    }
  }

  const ids = rows.map((r) => r.id)
  const { data: milestoneRows } = await supabase
    .from('quotation_requirement_milestones')
    .select('*')
    .in('requirement_id', ids)
    .order('created_at', { ascending: true })

  const milestonesByReq = new Map<string, QuotationRequirementMilestone[]>()
  ;(milestoneRows as Array<{
    id: string
    requirement_id: string
    quotation_id: string
    title: string
    description: string | null
    due_date: string | null
    amount: string
    created_by: string
    created_at: string
    updated_at: string
  }> | null)?.forEach((m) => {
    const list = milestonesByReq.get(m.requirement_id) || []
    list.push({
      id: m.id,
      requirement_id: m.requirement_id,
      quotation_id: m.quotation_id,
      title: m.title,
      description: m.description,
      due_date: m.due_date,
      amount: decryptAmount(m.amount) ?? 0,
      created_by: m.created_by,
      created_at: m.created_at,
      updated_at: m.updated_at,
    })
    milestonesByReq.set(m.requirement_id, list)
  })

  const userIds = [...new Set(rows.map((r) => r.created_by))]
  const { data: users } = await supabase.from('users').select('id, full_name').in('id', userIds)
  const userMap = new Map<string, string>()
  ;(users as Array<{ id: string; full_name: string | null }> | null)?.forEach((u) => {
    userMap.set(u.id, u.full_name || 'Unknown')
  })

  const data: QuotationRequirement[] = rows.map((r) => ({
    id: r.id,
    quotation_id: r.quotation_id,
    requirement_type: r.requirement_type as QuotationRequirementType,
    pricing_type: (r.pricing_type || 'hourly') as QuotationPricingType,
    title: r.title,
    description: r.description,
    attachment_url: r.attachment_url,
    estimated_hours: normalizeNumber(r.estimated_hours),
    hourly_rate: r.hourly_rate ? decryptAmount(r.hourly_rate) : null,
    amount: r.amount ? decryptAmount(r.amount) : null,
    created_by: r.created_by,
    created_by_name: userMap.get(r.created_by) ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    milestones: milestonesByReq.get(r.id) || [],
  }))

  let subtotal = 0
  data.forEach((r) => {
    if (r.amount != null) subtotal += r.amount
  })
  subtotal = roundCurrency(subtotal)
  const { data: qRow } = await supabase.from('quotations').select('discount').eq('id', quotationId).single()
  const discount = (qRow as { discount: number } | null)?.discount ?? 0
  const final_total = roundCurrency(Math.max(0, subtotal - discount))

  return { data, subtotal, discount, final_total, error: null }
}

export async function createQuotationRequirement(
  quotationId: string,
  formData: QuotationRequirementFormData
): Promise<QuotationRequirementActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to add requirements' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.quotations, 'write')
  if (!canWrite) {
    return { data: null, error: 'You do not have permission to edit this quotation' }
  }

  const supabase = await createClient()
  const { data: quot } = await supabase.from('quotations').select('id, status').eq('id', quotationId).single()
  if (!quot) {
    return { data: null, error: 'Quotation not found' }
  }
  if ((quot as { status: string }).status === 'converted') {
    return { data: null, error: 'Converted quotation cannot be modified' }
  }

  const requirementType = (formData.requirement_type ?? 'initial') as QuotationRequirementType
  const pricingType = (formData.pricing_type ?? 'hourly') as QuotationPricingType
  if (!['initial', 'addon'].includes(requirementType)) {
    return { data: null, error: 'Invalid requirement type' }
  }
  if (!['hourly', 'fixed', 'milestone'].includes(pricingType)) {
    return { data: null, error: 'Invalid pricing type' }
  }

  const description = formData.description?.trim() || null
  const title = formData.title?.trim() || null

  let milestonesTotal: number | null = null
  const milestones: { title: string; description?: string | null; due_date?: string | null; amount: number }[] = []
  if (pricingType === 'milestone') {
    const raw = formData.milestones ?? []
    if (raw.length === 0) {
      return { data: null, error: 'Please add at least one milestone.' }
    }
    let total = 0
    for (const m of raw) {
      const t = m.title?.trim() ?? ''
      if (!t) return { data: null, error: 'Milestone title is required.' }
      const amt = normalizeNumber(m.amount)
      if (amt === null || amt < 0) return { data: null, error: 'Milestone amount must be zero or greater.' }
      total += amt
      milestones.push({
        title: t,
        description: m.description?.trim() || null,
        due_date: m.due_date || null,
        amount: amt,
      })
    }
    milestonesTotal = roundCurrency(total)
  }

  const estimatedHours = pricingType === 'hourly' ? normalizeNumber(formData.estimated_hours) : null
  const hourlyRate = pricingType === 'hourly' ? normalizeNumber(formData.hourly_rate) : null
  const amountInput = pricingType === 'milestone' ? null : normalizeNumber(formData.amount)
  const calculatedAmount =
    pricingType === 'milestone'
      ? milestonesTotal
      : pricingType === 'hourly' && amountInput === null && estimatedHours != null && hourlyRate != null
        ? roundCurrency(estimatedHours * hourlyRate)
        : amountInput

  const attachmentUrl = formData.attachment_url?.trim() || null

  const { data: inserted, error } = await supabase
    .from('quotation_requirements')
    .insert({
      quotation_id: quotationId,
      requirement_type: requirementType,
      pricing_type: pricingType,
      title,
      description,
      attachment_url: attachmentUrl,
      estimated_hours: estimatedHours,
      hourly_rate: hourlyRate != null ? encryptAmount(hourlyRate) : null,
      amount: calculatedAmount != null ? encryptAmount(calculatedAmount) : null,
      created_by: currentUser.id,
    } as never)
    .select()
    .single()

  if (error || !inserted) {
    return { data: null, error: error?.message ?? 'Failed to create requirement' }
  }

  const reqId = (inserted as { id: string }).id
  if (pricingType === 'milestone' && milestones.length > 0) {
    const milestoneRows = milestones.map((m) => ({
      requirement_id: reqId,
      quotation_id: quotationId,
      title: m.title,
      description: m.description || null,
      due_date: m.due_date || null,
      amount: encryptAmount(m.amount) ?? '0',
      created_by: currentUser.id,
    }))
    await supabase.from('quotation_requirement_milestones').insert(milestoneRows as never)
  }

  await recalcQuotationTotals(supabase, quotationId)
  revalidatePath(`/dashboard/quotations/${quotationId}`)
  revalidatePath('/dashboard/quotations')

  const result = await getQuotationRequirements(quotationId)
  const created = result.data.find((r) => r.id === reqId)
  return {
    data: created ?? {
      id: reqId,
      quotation_id: quotationId,
      requirement_type: requirementType,
      pricing_type: pricingType,
      title,
      description,
      attachment_url: attachmentUrl,
      estimated_hours: estimatedHours,
      hourly_rate: hourlyRate,
      amount: calculatedAmount,
      created_by: currentUser.id,
      created_by_name: currentUser.fullName ?? currentUser.email ?? null,
      created_at: (inserted as { created_at: string }).created_at,
      updated_at: (inserted as { updated_at: string }).updated_at,
      milestones: pricingType === 'milestone' ? milestones.map((m, i) => ({
        id: '',
        requirement_id: reqId,
        quotation_id: quotationId,
        title: m.title,
        description: m.description ?? null,
        due_date: m.due_date ?? null,
        amount: m.amount,
        created_by: currentUser.id,
        created_at: (inserted as { created_at: string }).created_at,
        updated_at: (inserted as { updated_at: string }).updated_at,
      })) : [],
    },
    error: null,
  }
}

export async function updateQuotationRequirement(
  requirementId: string,
  formData: QuotationRequirementFormData
): Promise<QuotationRequirementActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update requirements' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.quotations, 'write')
  if (!canWrite) {
    return { data: null, error: 'No permission' }
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('quotation_requirements')
    .select('id, quotation_id')
    .eq('id', requirementId)
    .single()
  if (!existing) {
    return { data: null, error: 'Requirement not found' }
  }
  const quotationId = (existing as { quotation_id: string }).quotation_id
  const { data: quot } = await supabase.from('quotations').select('status').eq('id', quotationId).single()
  if (quot && (quot as { status: string }).status === 'converted') {
    return { data: null, error: 'Converted quotation cannot be modified' }
  }

  const pricingType = (formData.pricing_type ?? 'hourly') as QuotationPricingType
  const description = formData.description !== undefined ? formData.description?.trim() || null : undefined
  const title = formData.title !== undefined ? formData.title?.trim() || null : undefined

  let calculatedAmount: number | null = null
  let milestones: { title: string; description?: string | null; due_date?: string | null; amount: number }[] = []
  if (pricingType === 'milestone' && Array.isArray(formData.milestones)) {
    if (formData.milestones.length === 0) {
      return { data: null, error: 'Please add at least one milestone.' }
    }
    let total = 0
    for (const m of formData.milestones) {
      const t = m.title?.trim() ?? ''
      if (!t) return { data: null, error: 'Milestone title is required.' }
      const amt = normalizeNumber(m.amount)
      if (amt === null || amt < 0) return { data: null, error: 'Milestone amount must be zero or greater.' }
      total += amt
      milestones.push({ title: t, description: m.description?.trim() || null, due_date: m.due_date || null, amount: amt })
    }
    calculatedAmount = roundCurrency(total)
  } else if (pricingType === 'hourly') {
    const estimatedHours = normalizeNumber(formData.estimated_hours)
    const hourlyRate = normalizeNumber(formData.hourly_rate)
    const amountInput = normalizeNumber(formData.amount)
    calculatedAmount =
      amountInput ??
      (estimatedHours != null && hourlyRate != null ? roundCurrency(estimatedHours * hourlyRate) : null)
  } else {
    calculatedAmount = normalizeNumber(formData.amount)
  }

  const updatePayload: Record<string, unknown> = {}
  if (formData.requirement_type !== undefined) updatePayload.requirement_type = formData.requirement_type
  if (formData.pricing_type !== undefined) updatePayload.pricing_type = formData.pricing_type
  if (title !== undefined) updatePayload.title = title
  if (description !== undefined) updatePayload.description = description
  if (formData.attachment_url !== undefined) updatePayload.attachment_url = formData.attachment_url?.trim() || null
  if (formData.estimated_hours !== undefined) updatePayload.estimated_hours = formData.estimated_hours
  if (formData.hourly_rate !== undefined) updatePayload.hourly_rate = formData.hourly_rate != null ? encryptAmount(formData.hourly_rate) : null
  if (calculatedAmount !== undefined && calculatedAmount !== null) updatePayload.amount = encryptAmount(calculatedAmount)

  const { data: updated, error } = await supabase
    .from('quotation_requirements')
    .update(updatePayload as never)
    .eq('id', requirementId)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  if (pricingType === 'milestone') {
    await supabase.from('quotation_requirement_milestones').delete().eq('requirement_id', requirementId)
    if (milestones.length > 0) {
      const rows = milestones.map((m) => ({
        requirement_id: requirementId,
        quotation_id: quotationId,
        title: m.title,
        description: m.description || null,
        due_date: m.due_date || null,
        amount: encryptAmount(m.amount) ?? '0',
        created_by: currentUser.id,
      }))
      await supabase.from('quotation_requirement_milestones').insert(rows as never)
    }
  }

  await recalcQuotationTotals(supabase, quotationId)
  revalidatePath(`/dashboard/quotations/${quotationId}`)
  revalidatePath('/dashboard/quotations')

  const result = await getQuotationRequirements(quotationId)
  const req = result.data.find((r) => r.id === requirementId)
  return { data: req ?? (updated as unknown as QuotationRequirement), error: null }
}

export async function deleteQuotationRequirement(requirementId: string): Promise<{ error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'You must be logged in to delete requirements' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.quotations, 'write')
  if (!canWrite) {
    return { error: 'No permission' }
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('quotation_requirements')
    .select('quotation_id')
    .eq('id', requirementId)
    .single()
  if (!existing) {
    return { error: 'Requirement not found' }
  }
  const quotationId = (existing as { quotation_id: string }).quotation_id
  const { data: quot } = await supabase.from('quotations').select('status').eq('id', quotationId).single()
  if (quot && (quot as { status: string }).status === 'converted') {
    return { error: 'Converted quotation cannot be modified' }
  }

  const { error } = await supabase.from('quotation_requirements').delete().eq('id', requirementId)
  if (error) {
    return { error: error.message }
  }
  await recalcQuotationTotals(supabase, quotationId)
  revalidatePath(`/dashboard/quotations/${quotationId}`)
  revalidatePath('/dashboard/quotations')
  return { error: null }
}

// ---------- Conversion ----------

/** For Convert from Lead: creates Client from quotation snapshot and returns client_id for pre-filling Project modal. */
export async function startQuotationConversion(quotationId: string): Promise<StartConversionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { client_id: '', quotation: null!, error: 'You must be logged in to convert a quotation' }
  }
  const canWriteQuotations = await hasPermission(currentUser, MODULE_PERMISSION_IDS.quotations, 'write')
  if (!canWriteQuotations) {
    return { client_id: '', quotation: null!, error: 'You do not have permission to convert quotations' }
  }

  const res = await getQuotation(quotationId)
  if (res.error || !res.data) {
    return { client_id: '', quotation: null!, error: res.error ?? 'Quotation not found' }
  }
  const quotation = res.data
  if (quotation.status !== 'approved') {
    return { client_id: '', quotation: null!, error: 'Only an approved quotation can be converted' }
  }

  let client_id: string

  if (quotation.source_type === 'lead') {
    const canWriteClients = await hasPermission(currentUser, MODULE_PERMISSION_IDS.clients, 'write')
    const canWriteLeads = await hasPermission(currentUser, MODULE_PERMISSION_IDS.leads, 'write')
    if (!canWriteClients || !canWriteLeads) {
      return {
        client_id: '',
        quotation: null!,
        error: 'You need both Quotations and Clients (and Leads) write permission to convert from a lead',
      }
    }
    const name =
      quotation.client_snapshot_name?.trim() ||
      quotation.lead?.name ||
      ''
    const phone =
      quotation.client_snapshot_phone?.trim() ||
      quotation.lead?.phone ||
      ''
    if (!name || !phone) {
      return {
        client_id: '',
        quotation: null!,
        error: 'Client name and phone are required. Please complete the Client Information section.',
      }
    }
    const clientData: ClientFormData = {
      name,
      company_name: quotation.client_snapshot_company_name?.trim() || undefined,
      phone,
      email: quotation.client_snapshot_email?.trim() || undefined,
      status: 'active',
      remark: quotation.client_snapshot_remark?.trim() || undefined,
      lead_id: quotation.lead_id ?? undefined,
    }
    const clientResult = await createClientRecord(clientData)
    if (clientResult.error || !clientResult.data) {
      return { client_id: '', quotation: null!, error: clientResult.error ?? 'Failed to create client' }
    }
    client_id = (clientResult.data as { id: string }).id
  } else {
    if (!quotation.client_id) {
      return { client_id: '', quotation: null!, error: 'Quotation has no linked client' }
    }
    client_id = quotation.client_id
  }

  return { client_id, quotation, error: null }
}

/** Call after Project is created from conversion: transfers requirements, sets quotation and lead status. */
export async function completeQuotationConversion(
  quotationId: string,
  projectId: string
): Promise<{ error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'You must be logged in to complete conversion' }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.quotations, 'write')
  if (!canWrite) {
    return { error: 'You do not have permission to complete conversion' }
  }

  const supabase = await createClient()
  const { data: quotation, error: qErr } = await supabase
    .from('quotations')
    .select('id, source_type, lead_id, status')
    .eq('id', quotationId)
    .single()

  if (qErr || !quotation) {
    return { error: 'Quotation not found' }
  }
  const q = quotation as { source_type: string; lead_id: string | null; status: string }
  if (q.status !== 'approved') {
    return { error: 'Quotation is not approved' }
  }

  const { data: reqs } = await supabase
    .from('quotation_requirements')
    .select('id, requirement_type, title, description, attachment_url, estimated_hours, hourly_rate, amount, pricing_type')
    .eq('quotation_id', quotationId)
    .order('created_at', { ascending: true })

  const requirementRows = (reqs || []) as Array<{
    id: string
    requirement_type: string
    title: string | null
    description: string | null
    attachment_url: string | null
    estimated_hours: number | string | null
    hourly_rate: string | null
    amount: string | null
    pricing_type: string
  }>

  for (const r of requirementRows) {
    const { data: newReq, error: insertErr } = await supabase
      .from('project_requirements')
      .insert({
        project_id: projectId,
        requirement_type: 'initial',
        title: r.title,
        description: r.description,
        attachment_url: r.attachment_url,
        estimated_hours: r.estimated_hours,
        hourly_rate: r.hourly_rate,
        amount: r.amount,
        pricing_type: r.pricing_type || 'hourly',
        created_by: currentUser.id,
        is_from_quotation: true,
        quotation_id: quotationId,
      } as never)
      .select('id')
      .single()

    if (insertErr || !newReq) {
      console.error('Error transferring requirement:', insertErr)
      return { error: insertErr?.message ?? 'Failed to transfer requirements' }
    }

    const { data: milestones } = await supabase
      .from('quotation_requirement_milestones')
      .select('title, description, due_date, amount')
      .eq('requirement_id', r.id)
      .order('created_at', { ascending: true })

    if (milestones && (milestones as unknown[]).length > 0) {
      const milestoneRows = (milestones as Array<{ title: string; description: string | null; due_date: string | null; amount: string }>).map(
        (m) => ({
          requirement_id: (newReq as { id: string }).id,
          project_id: projectId,
          title: m.title,
          description: m.description,
          due_date: m.due_date,
          amount: m.amount,
          created_by: currentUser.id,
        })
      )
      await supabase.from('project_requirement_milestones').insert(milestoneRows as never)
    }
  }

  await supabase
    .from('quotations')
    .update({ status: 'converted' } as never)
    .eq('id', quotationId)

  if (q.source_type === 'lead' && q.lead_id) {
    const leadRes = await getLead(q.lead_id)
    if (leadRes.data) {
      const leadResUpdate = await updateLead(q.lead_id, {
        name: leadRes.data.name,
        company_name: leadRes.data.company_name ?? undefined,
        phone: leadRes.data.phone,
        source: leadRes.data.source ?? undefined,
        status: 'converted',
        follow_up_date: leadRes.data.follow_up_date ?? undefined,
        notes: leadRes.data.notes ?? undefined,
      })
      if (leadResUpdate.error) {
        console.error('Error updating lead status:', leadResUpdate.error)
      }
    }
  }

  revalidatePath('/dashboard/quotations')
  revalidatePath(`/dashboard/quotations/${quotationId}`)
  revalidatePath('/dashboard/projects')
  revalidatePath(`/dashboard/projects/${projectId}`)
  return { error: null }
}
