'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useCallback } from 'react'
import { SidebarToggleButton } from '@/app/components/dashboard/sidebar-context'
import { SearchInput } from '@/app/components/ui/search-input'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'
import { Pagination } from '@/app/components/ui/pagination'
import { useToast } from '@/app/components/ui/toast-context'
import { AccountingEntriesTable } from './accounting-entries-table'
import { AccountingAccountsTable } from './accounting-accounts-table'
import { AccountingCategoriesTable } from './accounting-categories-table'
import { EntryModal } from './entry-modal'
import { AccountModal } from './account-modal'
import { CategoryModal } from './category-modal'
import { AccountingDeleteModal } from './accounting-delete-modal'
import {
  createEntry,
  updateEntry,
  deleteEntry,
  createAccount,
  updateAccount,
  deleteAccount,
  createCategory,
  updateCategory,
  deleteCategory,
  type EntryListItem,
  type EntryFormData,
  type EntryType,
  type AccountListItem,
  type AccountFormData,
  type AccountStatus,
  type CategoryListItem,
  type CategoryFormData,
  type CategoryType,
  type CategoryStatus,
  type AccountSelectOption,
  type CategorySelectOption,
  type EntriesSummary,
} from '@/lib/accounting/actions'
export type AccountingTab = 'entries' | 'accounts' | 'categories'

const TAB_VALUES: AccountingTab[] = ['entries', 'accounts', 'categories']
const PAGE_SIZE_DEFAULT = 20
const SEARCH_DEBOUNCE_MS = 350

type EntriesInitial = {
  entriesData: EntryListItem[]
  entriesTotalCount: number
  entriesSummary: EntriesSummary
  entriesPage: number
  accountsForSelect: AccountSelectOption[]
  categoriesForSelect: CategorySelectOption[]
  initialEntriesSearch: string
  initialEntriesDateFrom: string
  initialEntriesDateTo: string
  initialEntriesType: EntryType | 'all'
  initialEntriesAccountId: string
  initialEntriesCategoryId: string
}

type AccountsInitial = {
  accountsData: AccountListItem[]
  accountsTotalCount: number
  accountsPage: number
  initialAccountsSearch: string
  initialAccountsStatus: AccountStatus | 'all'
}

type CategoriesInitial = {
  categoriesData: CategoryListItem[]
  categoriesTotalCount: number
  categoriesPage: number
  initialCategoriesSearch: string
  initialCategoriesType: CategoryType | 'all'
  initialCategoriesStatus: CategoryStatus | 'all'
}

type AccountingClientProps = {
  currentTab: AccountingTab
  canWrite: boolean
  pageSize: number
} & Partial<EntriesInitial> &
  Partial<AccountsInitial> &
  Partial<CategoriesInitial>

export function AccountingClient(props: AccountingClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { success: showSuccess, error: showError } = useToast()
  const {
    currentTab,
    canWrite,
    pageSize = PAGE_SIZE_DEFAULT,
  } = props

  const basePath = pathname || '/dashboard/accounting'

  const buildParams = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const p = new URLSearchParams()
      p.set('tab', currentTab)
      const pageRaw = updates.page ?? (currentTab === 'entries' ? props.entriesPage : currentTab === 'accounts' ? props.accountsPage : props.categoriesPage) ?? 1
      const page = typeof pageRaw === 'number' ? pageRaw : Math.max(1, parseInt(String(pageRaw), 10) || 1)
      if (page > 1) p.set('page', String(page))
      if (currentTab === 'entries') {
        const search = updates.search ?? props.initialEntriesSearch ?? ''
        const from = updates.from ?? props.initialEntriesDateFrom ?? ''
        const to = updates.to ?? props.initialEntriesDateTo ?? ''
        const type = updates.type ?? props.initialEntriesType ?? 'all'
        const account = updates.account ?? props.initialEntriesAccountId ?? ''
        const category = updates.category ?? props.initialEntriesCategoryId ?? ''
        if (search) p.set('search', String(search))
        if (from) p.set('from', String(from))
        if (to) p.set('to', String(to))
        if (type && type !== 'all') p.set('type', String(type))
        if (account) p.set('account', String(account))
        if (category) p.set('category', String(category))
      } else if (currentTab === 'accounts') {
        const search = updates.search ?? props.initialAccountsSearch ?? ''
        const status = updates.status ?? props.initialAccountsStatus ?? 'all'
        if (search) p.set('search', String(search))
        if (status && status !== 'all') p.set('status', String(status))
      } else {
        const search = updates.search ?? props.initialCategoriesSearch ?? ''
        const type = updates.type ?? props.initialCategoriesType ?? 'all'
        const status = updates.status ?? props.initialCategoriesStatus ?? 'all'
        if (search) p.set('search', String(search))
        if (type && type !== 'all') p.set('type', String(type))
        if (status && status !== 'all') p.set('status', String(status))
      }
      return p.toString()
    },
    [currentTab, props]
  )

  const setTab = (tab: AccountingTab) => {
    const p = new URLSearchParams()
    p.set('tab', tab)
    p.set('page', '1')
    router.push(`${basePath}?${p.toString()}`)
  }

  const exportToCsv = () => {
    if (currentTab === 'entries' && entriesData.length > 0) {
      const headers = ['Date', 'Type', 'Account', 'Category', 'Amount', 'Remarks']
      const rows = entriesData.map((e) => [e.entry_date, e.entry_type, e.account_name, e.category_name, e.amount, e.remarks ?? ''])
      const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `entries-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showSuccess('Exported', 'Entries exported as CSV.')
    } else if (currentTab === 'accounts' && accountsData.length > 0) {
      const headers = ['Account Name', 'Opening Balance', 'Total In', 'Total Out', 'Current Balance', 'Status']
      const rows = accountsData.map((a) => [a.name, a.opening_balance, a.total_in, a.total_out, a.current_balance, a.status])
      const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showSuccess('Exported', 'Accounts exported as CSV.')
    } else if (currentTab === 'categories' && categoriesData.length > 0) {
      const headers = ['Category Name', 'Type', 'Status']
      const rows = categoriesData.map((c) => [c.name, c.type, c.status])
      const csv = [headers.join(','), ...rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `categories-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showSuccess('Exported', 'Categories exported as CSV.')
    } else {
      showError('Nothing to export', 'No data to export for the current view.')
    }
  }

  const setEntriesPage = (page: number) => router.push(`${basePath}?${buildParams({ page })}`)
  const setAccountsPage = (page: number) => router.push(`${basePath}?${buildParams({ page })}`)
  const setCategoriesPage = (page: number) => router.push(`${basePath}?${buildParams({ page })}`)

  const hasEntriesFilters =
    (props.initialEntriesSearch ?? '') !== '' ||
    (props.initialEntriesDateFrom ?? '') !== '' ||
    (props.initialEntriesDateTo ?? '') !== '' ||
    (props.initialEntriesType ?? 'all') !== 'all' ||
    (props.initialEntriesAccountId ?? '') !== '' ||
    (props.initialEntriesCategoryId ?? '') !== ''
  const hasAccountsFilters = (props.initialAccountsSearch ?? '') !== '' || (props.initialAccountsStatus ?? 'all') !== 'all'
  const hasCategoriesFilters =
    (props.initialCategoriesSearch ?? '') !== '' ||
    (props.initialCategoriesType ?? 'all') !== 'all' ||
    (props.initialCategoriesStatus ?? 'all') !== 'all'

  const resetFilters = () => {
    const p = new URLSearchParams()
    p.set('tab', currentTab)
    router.push(`${basePath}?${p.toString()}`)
  }

  // Entry modals
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [entryModalMode, setEntryModalMode] = useState<'create' | 'edit'>('create')
  const [entryModalType, setEntryModalType] = useState<EntryType>('income')
  const [editingEntry, setEditingEntry] = useState<EntryListItem | null>(null)
  const [entrySubmitting, setEntrySubmitting] = useState(false)
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null)
  const [deleteEntryLoading, setDeleteEntryLoading] = useState(false)

  const openAddIncome = () => {
    setEntryModalType('income')
    setEntryModalMode('create')
    setEditingEntry(null)
    setEntryModalOpen(true)
  }
  const openAddExpense = () => {
    setEntryModalType('expense')
    setEntryModalMode('create')
    setEditingEntry(null)
    setEntryModalOpen(true)
  }
  const openEditEntry = (row: EntryListItem) => {
    setEditingEntry(row)
    setEntryModalMode('edit')
    setEntryModalOpen(true)
  }
  const handleEntrySubmit = async (form: EntryFormData) => {
    if (!canWrite) {
      showError('Read-only', 'You do not have permission to modify entries.')
      return { error: 'Permission denied' }
    }
    setEntrySubmitting(true)
    const result = entryModalMode === 'create' ? await createEntry(form) : editingEntry ? await updateEntry(editingEntry.id, form) : { data: null, error: 'No entry' }
    setEntrySubmitting(false)
    if (result.error) return { error: result.error }
    showSuccess(entryModalMode === 'create' ? 'Entry created' : 'Entry updated', '')
    setEntryModalOpen(false)
    router.refresh()
    return { error: null }
  }
  const handleDeleteEntry = async () => {
    if (!deleteEntryId) return
    setDeleteEntryLoading(true)
    const result = await deleteEntry(deleteEntryId)
    setDeleteEntryLoading(false)
    if (result.error) {
      showError('Delete failed', result.error)
      return
    }
    showSuccess('Entry deleted', '')
    setDeleteEntryId(null)
    router.refresh()
  }

  // Account modals
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [accountModalMode, setAccountModalMode] = useState<'create' | 'edit'>('create')
  const [editingAccount, setEditingAccount] = useState<AccountListItem | null>(null)
  const [accountSubmitting, setAccountSubmitting] = useState(false)
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)

  const openAddAccount = () => {
    setAccountModalMode('create')
    setEditingAccount(null)
    setAccountModalOpen(true)
  }
  const openEditAccount = (row: AccountListItem) => {
    setAccountDetailPanel(null)
    setEditingAccount(row)
    setAccountModalMode('edit')
    setAccountModalOpen(true)
  }
  const openAccountDetail = (row: AccountListItem) => setAccountDetailPanel(row)
  const viewAccountEntries = () => {
    if (accountDetailPanel) {
      const p = new URLSearchParams()
      p.set('tab', 'entries')
      p.set('account', accountDetailPanel.id)
      router.push(`${basePath}?${p.toString()}`)
      setAccountDetailPanel(null)
    }
  }
  const handleAccountSubmit = async (form: AccountFormData) => {
    if (!canWrite) {
      showError('Read-only', 'You do not have permission to modify accounts.')
      return { error: 'Permission denied' }
    }
    setAccountSubmitting(true)
    const result = accountModalMode === 'create' ? await createAccount(form) : editingAccount ? await updateAccount(editingAccount.id, form) : { data: null, error: 'No account' }
    setAccountSubmitting(false)
    if (result.error) return { error: result.error }
    showSuccess(accountModalMode === 'create' ? 'Account created' : 'Account updated', '')
    setAccountModalOpen(false)
    router.refresh()
    return { error: null }
  }
  const handleDeleteAccount = async () => {
    if (!deleteAccountId) return
    setDeleteAccountLoading(true)
    const result = await deleteAccount(deleteAccountId)
    setDeleteAccountLoading(false)
    if (result.error) {
      showError('Delete failed', result.error)
      return
    }
    showSuccess('Account deleted', '')
    setDeleteAccountId(null)
    router.refresh()
  }

  // Category modals
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [categoryModalMode, setCategoryModalMode] = useState<'create' | 'edit'>('create')
  const [editingCategory, setEditingCategory] = useState<CategoryListItem | null>(null)
  const [categorySubmitting, setCategorySubmitting] = useState(false)
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null)
  const [deleteCategoryLoading, setDeleteCategoryLoading] = useState(false)

  const [accountDetailPanel, setAccountDetailPanel] = useState<AccountListItem | null>(null)

  const openAddCategory = () => {
    setCategoryModalMode('create')
    setEditingCategory(null)
    setCategoryModalOpen(true)
  }
  const openEditCategory = (row: CategoryListItem) => {
    setEditingCategory(row)
    setCategoryModalMode('edit')
    setCategoryModalOpen(true)
  }
  const handleCategorySubmit = async (form: CategoryFormData) => {
    if (!canWrite) {
      showError('Read-only', 'You do not have permission to modify categories.')
      return { error: 'Permission denied' }
    }
    setCategorySubmitting(true)
    const result = categoryModalMode === 'create' ? await createCategory(form) : editingCategory ? await updateCategory(editingCategory.id, form) : { data: null, error: 'No category' }
    setCategorySubmitting(false)
    if (result.error) return { error: result.error }
    showSuccess(categoryModalMode === 'create' ? 'Category created' : 'Category updated', '')
    setCategoryModalOpen(false)
    router.refresh()
    return { error: null }
  }
  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return
    setDeleteCategoryLoading(true)
    const result = await deleteCategory(deleteCategoryId)
    setDeleteCategoryLoading(false)
    if (result.error) {
      showError('Delete failed', result.error)
      return
    }
    showSuccess('Category deleted', '')
    setDeleteCategoryId(null)
    router.refresh()
  }

  const entriesSummary = props.entriesSummary
  const entriesData = props.entriesData ?? []
  const accountsData = props.accountsData ?? []
  const categoriesData = props.categoriesData ?? []

  return (
    <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <SidebarToggleButton />
          <h1 className="text-xl font-semibold text-[#1E1B4B] sm:text-2xl">Accounting</h1>
        </div>
      </div>

      {/* Tab bar with Add/Create buttons inline */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 mb-4">
        <div className="flex gap-1">
          {TAB_VALUES.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                currentTab === tab
                  ? 'bg-white border border-b-0 border-gray-200 text-[#06B6D4] -mb-px font-medium'
                  : 'text-gray-600 hover:text-[#1E1B4B] hover:bg-gray-50 font-medium'
              }`}
            >
              {tab === 'entries' ? 'Entries' : tab === 'accounts' ? 'Account' : 'Categories'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          {currentTab === 'entries' && canWrite && (
            <>
              <button
                type="button"
                onClick={openAddIncome}
                className="btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg"
              >
                Add Income
              </button>
              <button
                type="button"
                onClick={openAddExpense}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
              >
                Add Expense
              </button>
            </>
          )}
          {currentTab === 'accounts' && canWrite && (
            <button
              type="button"
              onClick={openAddAccount}
              className="btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg"
            >
              Add Account
            </button>
          )}
          {currentTab === 'categories' && canWrite && (
            <button
              type="button"
              onClick={openAddCategory}
              className="btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg"
            >
              Add Category
            </button>
          )}
        </div>
      </div>

      {/* Dynamic action & filter bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 bg-white px-4 py-4 rounded-t-lg">
        {/* Filters on the left */}
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-start">
          {currentTab === 'entries' && (
            <>
              <div className="w-full sm:w-48">
                <SearchInput
                  value={props.initialEntriesSearch ?? ''}
                  onChange={(q) => router.push(`${basePath}?${buildParams({ search: q, page: 1 })}`)}
                  placeholder="Search by remarks..."
                  debounceMs={SEARCH_DEBOUNCE_MS}
                  minLength={0}
                />
              </div>
              <input
                type="date"
                value={props.initialEntriesDateFrom ?? ''}
                onChange={(e) => router.push(`${basePath}?${buildParams({ from: e.target.value || undefined, page: 1 })}`)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={props.initialEntriesDateTo ?? ''}
                onChange={(e) => router.push(`${basePath}?${buildParams({ to: e.target.value || undefined, page: 1 })}`)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <ListboxDropdown
                value={props.initialEntriesType ?? 'all'}
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'income', label: 'Income' },
                  { value: 'expense', label: 'Expense' },
                ]}
                onChange={(v) => router.push(`${basePath}?${buildParams({ type: v, page: 1 })}`)}
                ariaLabel="Entry type"
              />
              {(props.accountsForSelect?.length ?? 0) > 0 && (
                <ListboxDropdown
                  value={props.initialEntriesAccountId ?? ''}
                  options={[{ value: '', label: 'All accounts' }, ...(props.accountsForSelect ?? []).map((a) => ({ value: a.id, label: a.name }))]}
                  onChange={(v) => router.push(`${basePath}?${buildParams({ account: v, page: 1 })}`)}
                  ariaLabel="Account"
                />
              )}
              {(props.categoriesForSelect?.length ?? 0) > 0 && (
                <ListboxDropdown
                  value={props.initialEntriesCategoryId ?? ''}
                  options={[{ value: '', label: 'All categories' }, ...(props.categoriesForSelect ?? []).map((c) => ({ value: c.id, label: c.name }))]}
                  onChange={(v) => router.push(`${basePath}?${buildParams({ category: v, page: 1 })}`)}
                  ariaLabel="Category"
                />
              )}
            </>
          )}
          {currentTab === 'accounts' && (
            <>
              <div className="w-full sm:w-48">
                <SearchInput
                  value={props.initialAccountsSearch ?? ''}
                  onChange={(q) => router.push(`${basePath}?${buildParams({ search: q, page: 1 })}`)}
                  placeholder="Search by account name..."
                  debounceMs={SEARCH_DEBOUNCE_MS}
                  minLength={0}
                />
              </div>
              <ListboxDropdown
                value={props.initialAccountsStatus ?? 'all'}
                options={[
                  { value: 'all', label: 'All status' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                onChange={(v) => router.push(`${basePath}?${buildParams({ status: v, page: 1 })}`)}
                ariaLabel="Status"
              />
            </>
          )}
          {currentTab === 'categories' && (
            <>
              <div className="w-full sm:w-48">
                <SearchInput
                  value={props.initialCategoriesSearch ?? ''}
                  onChange={(q) => router.push(`${basePath}?${buildParams({ search: q, page: 1 })}`)}
                  placeholder="Search by category name..."
                  debounceMs={SEARCH_DEBOUNCE_MS}
                  minLength={0}
                />
              </div>
              <ListboxDropdown
                value={props.initialCategoriesType ?? 'all'}
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'income', label: 'Income' },
                  { value: 'expense', label: 'Expense' },
                ]}
                onChange={(v) => router.push(`${basePath}?${buildParams({ type: v, page: 1 })}`)}
                ariaLabel="Type"
              />
              <ListboxDropdown
                value={props.initialCategoriesStatus ?? 'all'}
                options={[
                  { value: 'all', label: 'All status' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                onChange={(v) => router.push(`${basePath}?${buildParams({ status: v, page: 1 })}`)}
                ariaLabel="Status"
              />
            </>
          )}
          {(currentTab === 'entries' && hasEntriesFilters) || (currentTab === 'accounts' && hasAccountsFilters) || (currentTab === 'categories' && hasCategoriesFilters) ? (
            <button type="button" onClick={resetFilters} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100">
              Reset filters
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={exportToCsv}
            className="btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg"
          >
            Export
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden rounded-b-lg bg-white shadow-sm flex flex-col min-h-0">
        {currentTab === 'entries' && (
          <>
            {entriesSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <div>
                  <p className="text-xs text-gray-500">Total Income</p>
                  <p className="text-sm font-semibold text-[#15803D]">
                    {entriesSummary.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Expense</p>
                  <p className="text-sm font-semibold text-[#B91C1C]">
                    {entriesSummary.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Net</p>
                  <p className={`text-sm font-semibold ${entriesSummary.net >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>
                    {entriesSummary.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Transactions</p>
                  <p className="text-sm font-semibold text-[#1E1B4B]">{entriesSummary.transactionsCount}</p>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-auto min-h-0">
              <AccountingEntriesTable
                entries={entriesData}
                canWrite={canWrite}
                onEdit={openEditEntry}
                onDelete={(id) => setDeleteEntryId(id)}
              />
            </div>
            {(props.entriesTotalCount ?? 0) > 0 && (
              <Pagination
                currentPage={props.entriesPage ?? 1}
                totalCount={props.entriesTotalCount ?? 0}
                pageSize={pageSize}
                onPageChange={setEntriesPage}
              />
            )}
          </>
        )}
        {currentTab === 'accounts' && (
          <>
            <div className="flex-1 overflow-auto min-h-0">
              <AccountingAccountsTable
                accounts={accountsData}
                canWrite={canWrite}
                onView={openAccountDetail}
                onEdit={openEditAccount}
                onDelete={(id) => setDeleteAccountId(id)}
              />
            </div>
            {(props.accountsTotalCount ?? 0) > 0 && (
              <Pagination
                currentPage={props.accountsPage ?? 1}
                totalCount={props.accountsTotalCount ?? 0}
                pageSize={pageSize}
                onPageChange={setAccountsPage}
              />
            )}
          </>
        )}
        {currentTab === 'categories' && (
          <>
            <div className="flex-1 overflow-auto min-h-0">
              <AccountingCategoriesTable
                categories={categoriesData}
                canWrite={canWrite}
                onEdit={openEditCategory}
                onDelete={(id) => setDeleteCategoryId(id)}
              />
            </div>
            {(props.categoriesTotalCount ?? 0) > 0 && (
              <Pagination
                currentPage={props.categoriesPage ?? 1}
                totalCount={props.categoriesTotalCount ?? 0}
                pageSize={pageSize}
                onPageChange={setCategoriesPage}
              />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <EntryModal
        isOpen={entryModalOpen}
        onClose={() => { setEntryModalOpen(false); setEditingEntry(null) }}
        mode={entryModalMode}
        initialEntryType={entryModalType}
        initialData={editingEntry ? { entry_type: editingEntry.entry_type, account_id: editingEntry.account_id, category_id: editingEntry.category_id, amount: editingEntry.amount, entry_date: editingEntry.entry_date, remarks: editingEntry.remarks, project_id: editingEntry.project_id } : undefined}
        accounts={props.accountsForSelect ?? []}
        categories={props.categoriesForSelect ?? []}
        isLoading={entrySubmitting}
        onSubmit={handleEntrySubmit}
      />
      <AccountModal
        isOpen={accountModalOpen}
        onClose={() => { setAccountModalOpen(false); setEditingAccount(null) }}
        mode={accountModalMode}
        initialData={editingAccount ? { name: editingAccount.name, opening_balance: editingAccount.opening_balance, status: editingAccount.status, is_default: editingAccount.is_default } : undefined}
        isLoading={accountSubmitting}
        onSubmit={handleAccountSubmit}
      />
      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={() => { setCategoryModalOpen(false); setEditingCategory(null) }}
        mode={categoryModalMode}
        initialData={editingCategory ? { name: editingCategory.name, type: editingCategory.type, status: editingCategory.status } : undefined}
        isLoading={categorySubmitting}
        onSubmit={handleCategorySubmit}
      />
      <AccountingDeleteModal
        isOpen={!!deleteEntryId}
        onClose={() => setDeleteEntryId(null)}
        onConfirm={handleDeleteEntry}
        title="Delete entry"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        isLoading={deleteEntryLoading}
      />
      <AccountingDeleteModal
        isOpen={!!deleteAccountId}
        onClose={() => setDeleteAccountId(null)}
        onConfirm={handleDeleteAccount}
        title="Delete account"
        message="Are you sure you want to delete this account? You can only delete accounts with no entries."
        isLoading={deleteAccountLoading}
      />
      <AccountingDeleteModal
        isOpen={!!deleteCategoryId}
        onClose={() => setDeleteCategoryId(null)}
        onConfirm={handleDeleteCategory}
        title="Delete category"
        message="Are you sure you want to delete this category? You can only delete categories with no entries."
        isLoading={deleteCategoryLoading}
      />

      {/* Account detail panel */}
      {accountDetailPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/20" onClick={() => setAccountDetailPanel(null)} />
          <div className="relative z-10 w-full max-w-md bg-white shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-[#1E1B4B]">Account: {accountDetailPanel.name}</h2>
              <button type="button" onClick={() => setAccountDetailPanel(null)} className="rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Opening Balance</span><span className="font-medium">{accountDetailPanel.opening_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Total In</span><span className="font-medium text-[#15803D]">{accountDetailPanel.total_in.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Total Out</span><span className="font-medium text-[#B91C1C]">{accountDetailPanel.total_out.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-sm border-t border-gray-100 pt-3"><span className="text-gray-500">Current Balance</span><span className="font-semibold">{accountDetailPanel.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={viewAccountEntries}
                className="btn-gradient-smooth w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg"
              >
                View entries for this account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
