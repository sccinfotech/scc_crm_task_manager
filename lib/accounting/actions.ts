'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { prepareSearchTerm } from '@/lib/supabase/utils'

export type EntryType = 'income' | 'expense'
export type AccountStatus = 'active' | 'inactive'
export type CategoryType = 'income' | 'expense'
export type CategoryStatus = 'active' | 'inactive'

// ----- Entries -----
export type EntryFormData = {
  entry_type: EntryType
  account_id: string
  category_id: string
  amount: number
  entry_date: string
  remarks?: string | null
}

export type EntryListItem = {
  id: string
  entry_type: EntryType
  account_id: string
  account_name: string
  category_id: string
  category_name: string
  amount: number
  entry_date: string
  remarks: string | null
  created_at: string
}

export type EntriesSummary = {
  totalIncome: number
  totalExpense: number
  net: number
  transactionsCount: number
}

export type GetEntriesPageOptions = {
  search?: string
  dateFrom?: string
  dateTo?: string
  entryType?: EntryType | 'all'
  accountId?: string
  categoryId?: string
  sortField?: 'entry_date' | 'amount' | 'created_at'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export type GetEntriesPageResult = {
  data: EntryListItem[]
  totalCount: number
  summary: EntriesSummary
  error: string | null
}

// ----- Accounts -----
export type AccountFormData = {
  name: string
  opening_balance: number
  status: AccountStatus
}

export type AccountListItem = {
  id: string
  name: string
  opening_balance: number
  total_in: number
  total_out: number
  current_balance: number
  status: AccountStatus
  created_at: string
}

export type GetAccountsPageOptions = {
  search?: string
  status?: AccountStatus | 'all'
  sortField?: 'name' | 'current_balance' | 'created_at'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export type GetAccountsPageResult = {
  data: AccountListItem[]
  totalCount: number
  error: string | null
}

// ----- Categories -----
export type CategoryFormData = {
  name: string
  type: CategoryType
  status: CategoryStatus
}

export type CategoryListItem = {
  id: string
  name: string
  type: CategoryType
  status: CategoryStatus
  created_at: string
}

export type GetCategoriesPageOptions = {
  search?: string
  type?: CategoryType | 'all'
  status?: CategoryStatus | 'all'
  sortField?: 'name' | 'type' | 'created_at'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export type GetCategoriesPageResult = {
  data: CategoryListItem[]
  totalCount: number
  error: string | null
}

// ----- Select options for dropdowns -----
export type AccountSelectOption = { id: string; name: string; status: AccountStatus }
export type CategorySelectOption = { id: string; name: string; type: CategoryType; status: CategoryStatus }

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export async function getEntriesPage(options: GetEntriesPageOptions = {}): Promise<GetEntriesPageResult> {
  const user = await getCurrentUser()
  if (!user) return { data: [], totalCount: 0, summary: { totalIncome: 0, totalExpense: 0, net: 0, transactionsCount: 0 }, error: 'You must be logged in' }
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'read')
  if (!canRead) return { data: [], totalCount: 0, summary: { totalIncome: 0, totalExpense: 0, net: 0, transactionsCount: 0 }, error: 'No permission' }

  const supabase = await createClient()
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortField = options.sortField ?? 'entry_date'
  const sortDirection = options.sortDirection ?? 'desc'

  let q = supabase
    .from('accounting_entries')
    .select(
      'id, entry_type, account_id, category_id, amount, entry_date, remarks, created_at, financial_accounts(name), accounting_categories(name)',
      { count: 'exact' }
    )

  const remarksSearch = prepareSearchTerm(options.search)
  if (remarksSearch) q = q.ilike('remarks', `%${remarksSearch}%`)
  if (options.dateFrom) q = q.gte('entry_date', options.dateFrom)
  if (options.dateTo) q = q.lte('entry_date', options.dateTo)
  if (options.entryType && options.entryType !== 'all') q = q.eq('entry_type', options.entryType)
  if (options.accountId) q = q.eq('account_id', options.accountId)
  if (options.categoryId) q = q.eq('category_id', options.categoryId)

  q = q.order(sortField, { ascending: sortDirection === 'asc' })
  const { data: pageData, count, error } = await q.range(from, to)

  if (error) {
    console.error('getEntriesPage error:', error)
    return { data: [], totalCount: 0, summary: { totalIncome: 0, totalExpense: 0, net: 0, transactionsCount: 0 }, error: error.message }
  }

  // Summary with same filters (no pagination)
  let sumQ = supabase
    .from('accounting_entries')
    .select('entry_type, amount')
  if (remarksSearch) sumQ = sumQ.ilike('remarks', `%${remarksSearch}%`)
  if (options.dateFrom) sumQ = sumQ.gte('entry_date', options.dateFrom)
  if (options.dateTo) sumQ = sumQ.lte('entry_date', options.dateTo)
  if (options.entryType && options.entryType !== 'all') sumQ = sumQ.eq('entry_type', options.entryType)
  if (options.accountId) sumQ = sumQ.eq('account_id', options.accountId)
  if (options.categoryId) sumQ = sumQ.eq('category_id', options.categoryId)
  const { data: allRows } = await sumQ
  let totalIncome = 0
  let totalExpense = 0
  if (Array.isArray(allRows)) {
    for (const r of allRows) {
      const amt = toNum((r as { amount?: unknown }).amount)
      if ((r as { entry_type?: string }).entry_type === 'income') totalIncome += amt
      else totalExpense += amt
    }
  }

  const rows = (pageData ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    entry_type: r.entry_type as EntryType,
    account_id: r.account_id as string,
    account_name: ((r.financial_accounts as { name?: string } | null) ?? {}).name ?? '',
    category_id: r.category_id as string,
    category_name: ((r.accounting_categories as { name?: string } | null) ?? {}).name ?? '',
    amount: toNum(r.amount),
    entry_date: r.entry_date as string,
    remarks: (r.remarks as string) ?? null,
    created_at: r.created_at as string,
  }))

  return {
    data: rows,
    totalCount: count ?? 0,
    summary: {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      transactionsCount: count ?? 0,
    },
    error: null,
  }
}

export async function getAccountsPage(options: GetAccountsPageOptions = {}): Promise<GetAccountsPageResult> {
  const user = await getCurrentUser()
  if (!user) return { data: [], totalCount: 0, error: 'You must be logged in' }
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'read')
  if (!canRead) return { data: [], totalCount: 0, error: 'No permission' }

  const supabase = await createClient()
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  const sortField = options.sortField ?? 'name'
  const sortDirection = options.sortDirection ?? 'asc'

  let q = supabase.from('financial_accounts').select('id, name, opening_balance, status, created_at', { count: 'exact' })
  const nameSearch = prepareSearchTerm(options.search)
  if (nameSearch) q = q.ilike('name', `%${nameSearch}%`)
  if (options.status && options.status !== 'all') q = q.eq('status', options.status)
  q = q.order(sortField, { ascending: sortDirection === 'asc' })
  const { data: accounts, count, error } = await q.range((page - 1) * pageSize, page * pageSize - 1)

  if (error) {
    console.error('getAccountsPage error:', error)
    return { data: [], totalCount: 0, error: error.message }
  }

  const ids = (accounts ?? []).map((a: { id: string }) => a.id)
  if (ids.length === 0) {
    return {
      data: [],
      totalCount: count ?? 0,
      error: null,
    }
  }

  const { data: agg } = await supabase
    .from('accounting_entries')
    .select('account_id, entry_type, amount')
  const byAccount: Record<string, { in: number; out: number }> = {}
  for (const id of ids) byAccount[id] = { in: 0, out: 0 }
  if (Array.isArray(agg)) {
    for (const row of agg) {
      const aid = (row as { account_id: string }).account_id
      if (!(aid in byAccount)) continue
      const amt = toNum((row as { amount?: unknown }).amount)
      if ((row as { entry_type: string }).entry_type === 'income') byAccount[aid].in += amt
      else byAccount[aid].out += amt
    }
  }

  const list = (accounts ?? []).map((a: Record<string, unknown>) => {
    const id = a.id as string
    const ob = toNum(a.opening_balance)
    const { in: ti, out: to } = byAccount[id] ?? { in: 0, out: 0 }
    return {
      id,
      name: a.name as string,
      opening_balance: ob,
      total_in: ti,
      total_out: to,
      current_balance: ob + ti - to,
      status: a.status as AccountStatus,
      created_at: a.created_at as string,
    }
  })

  return { data: list, totalCount: count ?? 0, error: null }
}

export async function getCategoriesPage(options: GetCategoriesPageOptions = {}): Promise<GetCategoriesPageResult> {
  const user = await getCurrentUser()
  if (!user) return { data: [], totalCount: 0, error: 'You must be logged in' }
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'read')
  if (!canRead) return { data: [], totalCount: 0, error: 'No permission' }

  const supabase = await createClient()
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  const sortField = options.sortField ?? 'name'
  const sortDirection = options.sortDirection ?? 'asc'

  let q = supabase.from('accounting_categories').select('id, name, type, status, created_at', { count: 'exact' })
  const nameSearch = prepareSearchTerm(options.search)
  if (nameSearch) q = q.ilike('name', `%${nameSearch}%`)
  if (options.type && options.type !== 'all') q = q.eq('type', options.type)
  if (options.status && options.status !== 'all') q = q.eq('status', options.status)
  q = q.order(sortField, { ascending: sortDirection === 'asc' })
  const { data: rows, count, error } = await q.range((page - 1) * pageSize, page * pageSize - 1)

  if (error) {
    console.error('getCategoriesPage error:', error)
    return { data: [], totalCount: 0, error: error.message }
  }

  const list = (rows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    type: r.type as CategoryType,
    status: r.status as CategoryStatus,
    created_at: r.created_at as string,
  }))

  return { data: list, totalCount: count ?? 0, error: null }
}

export async function getAccountsForSelect(): Promise<{ data: AccountSelectOption[]; error: string | null }> {
  const user = await getCurrentUser()
  if (!user) return { data: [], error: 'You must be logged in' }
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'read')
  if (!canRead) return { data: [], error: 'No permission' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('financial_accounts')
    .select('id, name, status')
    .eq('status', 'active')
    .order('name')
  if (error) return { data: [], error: error.message }
  return {
    data: (data ?? []).map((r: { id: string; name: string; status: string }) => ({
      id: r.id,
      name: r.name,
      status: r.status as AccountStatus,
    })),
    error: null,
  }
}

export async function getCategoriesForSelect(entryType?: EntryType): Promise<{ data: CategorySelectOption[]; error: string | null }> {
  const user = await getCurrentUser()
  if (!user) return { data: [], error: 'You must be logged in' }
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'read')
  if (!canRead) return { data: [], error: 'No permission' }
  const supabase = await createClient()
  let q = supabase.from('accounting_categories').select('id, name, type, status').eq('status', 'active').order('name')
  if (entryType) q = q.eq('type', entryType)
  const { data, error } = await q
  if (error) return { data: [], error: error.message }
  return {
    data: (data ?? []).map((r: { id: string; name: string; type: string; status: string }) => ({
      id: r.id,
      name: r.name,
      type: r.type as CategoryType,
      status: r.status as CategoryStatus,
    })),
    error: null,
  }
}

// ----- Entry mutations -----
export type ActionResult<T = unknown> = { data: T | null; error: string | null }

export async function createEntry(form: EntryFormData): Promise<ActionResult<EntryListItem>> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'You must be logged in' }
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'write')
  if (!canWrite) return { data: null, error: 'No permission' }

  if (!form.account_id || !form.category_id || !form.entry_date) return { data: null, error: 'Account, category and date are required' }
  const amount = Number(form.amount)
  if (!Number.isFinite(amount) || amount <= 0) return { data: null, error: 'Amount must be a positive number' }

  const supabase = await createClient()
  const { data: acc } = await supabase.from('financial_accounts').select('id, status').eq('id', form.account_id).single()
  if (!acc || (acc as { status: string }).status !== 'active') return { data: null, error: 'Selected account is not active' }
  const { data: cat } = await supabase.from('accounting_categories').select('id, type, status').eq('id', form.category_id).single()
  if (!cat || (cat as { status: string }).status !== 'active') return { data: null, error: 'Selected category is not active' }
  if ((cat as { type: string }).type !== form.entry_type) return { data: null, error: 'Category type must match entry type (Income/Expense)' }

  const { data: inserted, error } = await supabase
    .from('accounting_entries')
    .insert({
      entry_type: form.entry_type,
      account_id: form.account_id,
      category_id: form.category_id,
      amount,
      entry_date: form.entry_date,
      remarks: form.remarks ?? null,
      created_by: user.id,
    } as never)
    .select('id, entry_type, account_id, category_id, amount, entry_date, remarks, created_at, financial_accounts(name), accounting_categories(name)')
    .single()

  if (error) {
    console.error('createEntry error:', error)
    return { data: null, error: error.message }
  }
  const r = inserted as Record<string, unknown>
  revalidatePath('/dashboard/accounting')
  return {
    data: {
      id: r.id as string,
      entry_type: r.entry_type as EntryType,
      account_id: r.account_id as string,
      account_name: ((r.financial_accounts as { name?: string } | null) ?? {}).name ?? '',
      category_id: r.category_id as string,
      category_name: ((r.accounting_categories as { name?: string } | null) ?? {}).name ?? '',
      amount: toNum(r.amount),
      entry_date: r.entry_date as string,
      remarks: (r.remarks as string) ?? null,
      created_at: r.created_at as string,
    },
    error: null,
  }
}

export async function updateEntry(
  entryId: string,
  form: EntryFormData
): Promise<ActionResult<EntryListItem>> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'You must be logged in' }
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'write')
  if (!canWrite) return { data: null, error: 'No permission' }

  if (!form.account_id || !form.category_id || !form.entry_date) return { data: null, error: 'Account, category and date are required' }
  const amount = Number(form.amount)
  if (!Number.isFinite(amount) || amount <= 0) return { data: null, error: 'Amount must be a positive number' }

  const supabase = await createClient()
  const { data: acc } = await supabase.from('financial_accounts').select('id, status').eq('id', form.account_id).single()
  if (!acc || (acc as { status: string }).status !== 'active') return { data: null, error: 'Selected account is not active' }
  const { data: cat } = await supabase.from('accounting_categories').select('id, type, status').eq('id', form.category_id).single()
  if (!cat || (cat as { status: string }).status !== 'active') return { data: null, error: 'Selected category is not active' }
  if ((cat as { type: string }).type !== form.entry_type) return { data: null, error: 'Category type must match entry type' }

  const { data: updated, error } = await supabase
    .from('accounting_entries')
    .update({
      entry_type: form.entry_type,
      account_id: form.account_id,
      category_id: form.category_id,
      amount,
      entry_date: form.entry_date,
      remarks: form.remarks ?? null,
    } as never)
    .eq('id', entryId)
    .select('id, entry_type, account_id, category_id, amount, entry_date, remarks, created_at, financial_accounts(name), accounting_categories(name)')
    .single()

  if (error) {
    console.error('updateEntry error:', error)
    return { data: null, error: error.message }
  }
  const r = updated as Record<string, unknown>
  revalidatePath('/dashboard/accounting')
  return {
    data: {
      id: r.id as string,
      entry_type: r.entry_type as EntryType,
      account_id: r.account_id as string,
      account_name: ((r.financial_accounts as { name?: string } | null) ?? {}).name ?? '',
      category_id: r.category_id as string,
      category_name: ((r.accounting_categories as { name?: string } | null) ?? {}).name ?? '',
      amount: toNum(r.amount),
      entry_date: r.entry_date as string,
      remarks: (r.remarks as string) ?? null,
      created_at: r.created_at as string,
    },
    error: null,
  }
}

export async function deleteEntry(entryId: string): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'You must be logged in' }
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'write')
  if (!canWrite) return { data: null, error: 'No permission' }

  const supabase = await createClient()
  const { error } = await supabase.from('accounting_entries').delete().eq('id', entryId)
  if (error) {
    console.error('deleteEntry error:', error)
    return { data: null, error: error.message }
  }
  revalidatePath('/dashboard/accounting')
  return { data: null, error: null }
}

// ----- Account mutations -----
export async function createAccount(form: AccountFormData): Promise<ActionResult<AccountListItem>> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'You must be logged in' }
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'write')
  if (!canWrite) return { data: null, error: 'No permission' }
  if (!form.name?.trim()) return { data: null, error: 'Account name is required' }
  const opening_balance = Number(form.opening_balance)
  if (!Number.isFinite(opening_balance)) return { data: null, error: 'Opening balance must be a number' }

  const supabase = await createClient()
  const { data: inserted, error } = await supabase
    .from('financial_accounts')
    .insert({
      name: form.name.trim(),
      opening_balance,
      status: form.status ?? 'active',
      created_by: user.id,
    } as never)
    .select()
    .single()
  if (error) {
    console.error('createAccount error:', error)
    return { data: null, error: error.message }
  }
  const a = inserted as Record<string, unknown>
  revalidatePath('/dashboard/accounting')
  return {
    data: {
      id: a.id as string,
      name: a.name as string,
      opening_balance: toNum(a.opening_balance),
      total_in: 0,
      total_out: 0,
      current_balance: toNum(a.opening_balance),
      status: (a.status as AccountStatus) ?? 'active',
      created_at: a.created_at as string,
    },
    error: null,
  }
}

export async function updateAccount(accountId: string, form: AccountFormData): Promise<ActionResult<AccountListItem>> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'You must be logged in' }
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'write')
  if (!canWrite) return { data: null, error: 'No permission' }
  if (!form.name?.trim()) return { data: null, error: 'Account name is required' }
  const opening_balance = Number(form.opening_balance)
  if (!Number.isFinite(opening_balance)) return { data: null, error: 'Opening balance must be a number' }

  const supabase = await createClient()
  const { data: existing } = await supabase.from('financial_accounts').select('id').eq('id', accountId).single()
  if (!existing) return { data: null, error: 'Account not found' }

  const { data: updated, error } = await supabase
    .from('financial_accounts')
    .update({ name: form.name.trim(), opening_balance, status: form.status ?? 'active' } as never)
    .eq('id', accountId)
    .select()
    .single()
  if (error) {
    console.error('updateAccount error:', error)
    return { data: null, error: error.message }
  }
  const a = updated as Record<string, unknown>
  const { data: agg } = await supabase.from('accounting_entries').select('entry_type, amount').eq('account_id', accountId)
  let ti = 0, to = 0
  if (Array.isArray(agg)) {
    for (const row of agg) {
      const amt = toNum((row as { amount?: unknown }).amount)
      if ((row as { entry_type: string }).entry_type === 'income') ti += amt
      else to += amt
    }
  }
  const ob = toNum(a.opening_balance)
  revalidatePath('/dashboard/accounting')
  return {
    data: {
      id: a.id as string,
      name: a.name as string,
      opening_balance: ob,
      total_in: ti,
      total_out: to,
      current_balance: ob + ti - to,
      status: (a.status as AccountStatus) ?? 'active',
      created_at: a.created_at as string,
    },
    error: null,
  }
}

export async function deleteAccount(accountId: string): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'You must be logged in' }
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'write')
  if (!canWrite) return { data: null, error: 'No permission' }

  const supabase = await createClient()
  const { count } = await supabase.from('accounting_entries').select('id', { count: 'exact', head: true }).eq('account_id', accountId)
  if (count && count > 0) return { data: null, error: 'Cannot delete account that has entries. Deactivate it instead.' }

  const { error } = await supabase.from('financial_accounts').delete().eq('id', accountId)
  if (error) {
    console.error('deleteAccount error:', error)
    return { data: null, error: error.message }
  }
  revalidatePath('/dashboard/accounting')
  return { data: null, error: null }
}

// ----- Category mutations -----
export async function createCategory(form: CategoryFormData): Promise<ActionResult<CategoryListItem>> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'You must be logged in' }
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'write')
  if (!canWrite) return { data: null, error: 'No permission' }
  if (!form.name?.trim()) return { data: null, error: 'Category name is required' }

  const supabase = await createClient()
  const { data: inserted, error } = await supabase
    .from('accounting_categories')
    .insert({
      name: form.name.trim(),
      type: form.type,
      status: form.status ?? 'active',
      created_by: user.id,
    } as never)
    .select()
    .single()
  if (error) {
    console.error('createCategory error:', error)
    return { data: null, error: error.message }
  }
  const c = inserted as Record<string, unknown>
  revalidatePath('/dashboard/accounting')
  return {
    data: {
      id: c.id as string,
      name: c.name as string,
      type: c.type as CategoryType,
      status: (c.status as CategoryStatus) ?? 'active',
      created_at: c.created_at as string,
    },
    error: null,
  }
}

export async function updateCategory(categoryId: string, form: CategoryFormData): Promise<ActionResult<CategoryListItem>> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'You must be logged in' }
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'write')
  if (!canWrite) return { data: null, error: 'No permission' }
  if (!form.name?.trim()) return { data: null, error: 'Category name is required' }

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('accounting_categories')
    .update({ name: form.name.trim(), type: form.type, status: form.status ?? 'active' } as never)
    .eq('id', categoryId)
    .select()
    .single()
  if (error) {
    console.error('updateCategory error:', error)
    return { data: null, error: error.message }
  }
  const c = updated as Record<string, unknown>
  revalidatePath('/dashboard/accounting')
  return {
    data: {
      id: c.id as string,
      name: c.name as string,
      type: c.type as CategoryType,
      status: (c.status as CategoryStatus) ?? 'active',
      created_at: c.created_at as string,
    },
    error: null,
  }
}

export async function deleteCategory(categoryId: string): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'You must be logged in' }
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'write')
  if (!canWrite) return { data: null, error: 'No permission' }

  const supabase = await createClient()
  const { count } = await supabase.from('accounting_entries').select('id', { count: 'exact', head: true }).eq('category_id', categoryId)
  if (count && count > 0) return { data: null, error: 'Cannot delete category that has entries. Deactivate it instead.' }

  const { error } = await supabase.from('accounting_categories').delete().eq('id', categoryId)
  if (error) {
    console.error('deleteCategory error:', error)
    return { data: null, error: error.message }
  }
  revalidatePath('/dashboard/accounting')
  return { data: null, error: null }
}
