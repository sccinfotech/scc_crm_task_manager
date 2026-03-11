'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'
import { decryptAmount } from '@/lib/amount-encryption'
import { getProjectRequirements } from '@/lib/projects/requirements-actions'
import type { ProjectRequirement, RequirementSummary } from '@/lib/projects/requirements-actions'
import {
  createEntry,
  getDefaultAccount,
  getOrCreateClientPaymentCategory,
  getAccountsForSelect,
  type AccountSelectOption,
  type EntryListItem,
} from '@/lib/accounting/actions'

export type PaymentProjectListItem = {
  id: string
  name: string
  logo_url: string | null
  client_name: string | null
  client_company_name: string | null
  total_amount: number
  received_amount: number
  pending_amount: number
}

export type PaymentProjectDetail = {
  project: {
    id: string
    name: string
    logo_url: string | null
    client_name: string | null
    client_company_name: string | null
  }
  requirements: ProjectRequirement[]
  requirementSummary: RequirementSummary
  paymentHistory: EntryListItem[]
  totalAmount: number
  receivedAmount: number
  pendingAmount: number
  paymentsCount: number
}

export type CreateProjectPaymentInput = {
  account_id: string
  amount: number
  entry_date: string
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function isAdmin(user: { role?: string | null }) {
  return user.role === 'admin'
}

export async function getPaymentProjectsPage(options: { search?: string; status?: 'all' | 'pending' | 'paid' } = { status: 'all' }): Promise<{
  data: PaymentProjectListItem[]
  error: string | null
}> {
  const user = await getCurrentUser()
  if (!user) return { data: [], error: 'You must be logged in' }
  if (!isAdmin(user)) return { data: [], error: 'Only admins can access the Payment module' }

  const supabase = await createClient()

  const { data: reqRows, error: reqError } = await supabase
    .from('project_requirements')
    .select('id, project_id, amount, pricing_type')
    .eq('is_deleted', false)

  if (reqError) {
    console.error('getPaymentProjectsPage requirements:', reqError)
    return { data: [], error: reqError.message }
  }

  const projectIds = [...new Set((reqRows ?? []).map((r: { project_id: string }) => r.project_id))]
  if (projectIds.length === 0) return { data: [], error: null }

  const { data: milestoneRows } = await supabase
    .from('project_requirement_milestones')
    .select('requirement_id, amount')
    .in('requirement_id', (reqRows ?? []).map((r: { id: string }) => r.id))

  const requirementAmountByReqId = new Map<string, number>()
  for (const row of reqRows ?? []) {
    const r = row as { id: string; project_id: string; amount: string | null; pricing_type: string }
    if (r.pricing_type === 'milestone') {
      const milestones = (milestoneRows ?? []).filter(
        (m: { requirement_id: string }) => m.requirement_id === r.id
      ) as Array<{ amount: string }>
      const total = milestones.reduce((sum, m) => sum + (decryptAmount(m.amount) ?? 0), 0)
      requirementAmountByReqId.set(r.id, roundCurrency(total))
    } else {
      requirementAmountByReqId.set(r.id, roundCurrency(decryptAmount(r.amount) ?? 0))
    }
  }

  const totalByProject = new Map<string, number>()
  for (const row of reqRows ?? []) {
    const r = row as { project_id: string }
    const amt = requirementAmountByReqId.get((row as { id: string }).id) ?? 0
    totalByProject.set(r.project_id, (totalByProject.get(r.project_id) ?? 0) + amt)
  }
  for (const [pid, t] of totalByProject) {
    totalByProject.set(pid, roundCurrency(t))
  }

  const { data: entryRows } = await supabase
    .from('accounting_entries')
    .select('project_id, amount')
    .in('project_id', projectIds)
    .eq('entry_type', 'income')
    .not('project_id', 'is', null)

  const receivedByProject = new Map<string, number>()
  for (const row of entryRows ?? []) {
    const r = row as { project_id: string; amount: number }
    if (r.project_id) {
      receivedByProject.set(r.project_id, (receivedByProject.get(r.project_id) ?? 0) + Number(r.amount))
    }
  }
  for (const [pid, t] of receivedByProject) {
    receivedByProject.set(pid, roundCurrency(t))
  }

  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, name, logo_url, client_id, clients(id, name, company_name)')
    .in('id', projectIds)

  if (projError) {
    console.error('getPaymentProjectsPage projects:', projError)
    return { data: [], error: projError.message }
  }

  const list: PaymentProjectListItem[] = (projects ?? []).map((p: Record<string, unknown>) => {
    const id = p.id as string
    const client = p.clients as { name?: string; company_name?: string } | null
    const total = totalByProject.get(id) ?? 0
    const received = receivedByProject.get(id) ?? 0
    const pending = roundCurrency(total - received)
    return {
      id,
      name: p.name as string,
      logo_url: (p.logo_url as string) ?? null,
      client_name: client?.name ?? null,
      client_company_name: client?.company_name ?? null,
      total_amount: total,
      received_amount: received,
      pending_amount: pending,
    }
  })

  let filtered = list
  const trimmedSearch = (options.search ?? '').trim().toLowerCase()
  if (trimmedSearch) {
    filtered = filtered.filter((item) => {
      const projectName = item.name?.toLowerCase() ?? ''
      const clientName = item.client_name?.toLowerCase() ?? ''
      const companyName = item.client_company_name?.toLowerCase() ?? ''
      return (
        projectName.includes(trimmedSearch) ||
        clientName.includes(trimmedSearch) ||
        companyName.includes(trimmedSearch)
      )
    })
  }
  const status = options.status ?? 'all'
  if (status === 'pending') {
    filtered = filtered.filter((item) => item.pending_amount > 0)
  } else if (status === 'paid') {
    filtered = filtered.filter((item) => item.pending_amount <= 0 && item.total_amount > 0)
  }

  return { data: filtered, error: null }
}

export async function getProjectPaymentDetail(projectId: string): Promise<{
  data: PaymentProjectDetail | null
  error: string | null
}> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'You must be logged in' }
  if (!isAdmin(user)) return { data: null, error: 'Only admins can access the Payment module' }

  const supabase = await createClient()

  const { data: projectRow, error: projErr } = await supabase
    .from('projects')
    .select('id, name, logo_url, client_id, clients(id, name, company_name)')
    .eq('id', projectId)
    .single()

  if (projErr || !projectRow) {
    return { data: null, error: projErr?.message ?? 'Project not found' }
  }

  const reqResult = await getProjectRequirements(projectId)
  if (reqResult.error) return { data: null, error: reqResult.error }
  const requirements = reqResult.data ?? []
  const requirementSummary = reqResult.summary ?? {
    initialAmount: 0,
    addonAmount: 0,
    totalAmount: 0,
  }
  const totalAmount = requirementSummary.totalAmount

  const { data: entries } = await supabase
    .from('accounting_entries')
    .select(
      'id, entry_type, account_id, category_id, amount, entry_date, remarks, created_at, financial_accounts(name), accounting_categories(name)'
    )
    .eq('project_id', projectId)
    .eq('entry_type', 'income')
    .order('entry_date', { ascending: false })

  const paymentHistory: EntryListItem[] = (entries ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    entry_type: 'income' as const,
    account_id: r.account_id as string,
    account_name: ((r.financial_accounts as { name?: string } | null) ?? {}).name ?? '',
    category_id: r.category_id as string,
    category_name: ((r.accounting_categories as { name?: string } | null) ?? {}).name ?? '',
    amount: Number(r.amount),
    entry_date: r.entry_date as string,
    remarks: (r.remarks as string) ?? null,
    project_id: projectId,
    project_name: (projectRow as { name?: string }).name ?? null,
    created_at: r.created_at as string,
  }))

  const receivedAmount = roundCurrency(
    paymentHistory.reduce((sum, e) => sum + e.amount, 0)
  )
  const pendingAmount = roundCurrency(totalAmount - receivedAmount)
  const paymentsCount = paymentHistory.length

  const client = (projectRow as { clients?: { name?: string; company_name?: string } }).clients

  return {
    data: {
      project: {
        id: projectRow.id,
        name: (projectRow as { name: string }).name,
        logo_url: (projectRow as { logo_url?: string }).logo_url ?? null,
        client_name: client?.name ?? null,
        client_company_name: client?.company_name ?? null,
      },
      requirements,
      requirementSummary,
      paymentHistory,
      totalAmount,
      receivedAmount,
      pendingAmount,
      paymentsCount,
    },
    error: null,
  }
}

export async function createProjectPayment(
  projectId: string,
  input: CreateProjectPaymentInput
): Promise<{ data: EntryListItem | null; error: string | null }> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'You must be logged in' }
  if (!isAdmin(user)) return { data: null, error: 'Only admins can add payments' }

  const { data: detail, error: detailErr } = await getProjectPaymentDetail(projectId)
  if (detailErr || !detail) {
    return { data: null, error: detailErr ?? 'Project not found' }
  }

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { data: null, error: 'Amount must be a positive number' }
  }
  if (amount > detail.pendingAmount) {
    return { data: null, error: `Amount cannot exceed pending balance (₹${detail.pendingAmount.toFixed(2)})` }
  }

  const catResult = await getOrCreateClientPaymentCategory()
  if (catResult.error || !catResult.data) {
    return { data: null, error: catResult.error ?? 'Could not resolve Client Payment category' }
  }

  const result = await createEntry({
    entry_type: 'income',
    account_id: input.account_id,
    category_id: catResult.data,
    amount,
    entry_date: input.entry_date,
    remarks: null,
    project_id: projectId,
  })

  if (result.error) return { data: null, error: result.error }

  revalidatePath('/dashboard/payments')
  revalidatePath(`/dashboard/payments/${projectId}`)
  revalidatePath('/dashboard/accounting')
  return { data: result.data, error: null }
}

export async function getPaymentModuleAccounts(): Promise<{
  data: AccountSelectOption[]
  defaultAccountId: string | null
  error: string | null
}> {
  const user = await getCurrentUser()
  if (!user) return { data: [], defaultAccountId: null, error: 'You must be logged in' }
  if (!isAdmin(user)) return { data: [], defaultAccountId: null, error: 'No permission' }

  const [accountsRes, defaultRes] = await Promise.all([
    getAccountsForSelect(),
    getDefaultAccount(),
  ])
  if (accountsRes.error) return { data: [], defaultAccountId: null, error: accountsRes.error }
  const defaultId = defaultRes.data?.id ?? null
  return { data: accountsRes.data ?? [], defaultAccountId: defaultId, error: null }
}
