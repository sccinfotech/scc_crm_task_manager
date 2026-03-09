import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import {
  getEntriesPage,
  getAccountsPage,
  getCategoriesPage,
  getAccountsForSelect,
  getCategoriesForSelect,
  type EntryType,
  type AccountStatus,
  type CategoryType,
  type CategoryStatus,
} from '@/lib/accounting/actions'
import { AccountingClient } from './accounting-client'

const PAGE_SIZE = 20

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    page?: string
    search?: string
    from?: string
    to?: string
    type?: string
    account?: string
    category?: string
    status?: string
  }>
}) {
  const user = await requireAuth()
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'read')
  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.accounting, 'write')
  const params = await searchParams
  const tab = (params.tab === 'accounts' || params.tab === 'categories' ? params.tab : 'entries') as AccountingTab
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  if (tab === 'entries') {
    const [entriesResult, accountsOpts, categoriesOpts] = await Promise.all([
      getEntriesPage({
        search: params.search,
        dateFrom: params.from,
        dateTo: params.to,
        entryType: (params.type as EntryType | 'all') || 'all',
        accountId: params.account,
        categoryId: params.category,
        sortField: 'entry_date',
        sortDirection: 'desc',
        page,
        pageSize: PAGE_SIZE,
      }),
      getAccountsForSelect(),
      getCategoriesForSelect(),
    ])
    if (entriesResult.error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p>Failed to load entries: {entriesResult.error}</p>
        </div>
      )
    }
    return (
      <AccountingClient
        currentTab="entries"
        canWrite={canWrite}
        pageSize={PAGE_SIZE}
        entriesData={entriesResult.data}
        entriesTotalCount={entriesResult.totalCount}
        entriesSummary={entriesResult.summary}
        entriesPage={page}
        accountsForSelect={accountsOpts.data}
        categoriesForSelect={categoriesOpts.data}
        initialEntriesSearch={params.search ?? ''}
        initialEntriesDateFrom={params.from ?? ''}
        initialEntriesDateTo={params.to ?? ''}
        initialEntriesType={(params.type as EntryType | 'all') ?? 'all'}
        initialEntriesAccountId={params.account ?? ''}
        initialEntriesCategoryId={params.category ?? ''}
      />
    )
  }

  if (tab === 'accounts') {
    const accountsResult = await getAccountsPage({
      search: params.search,
      status: (params.status as AccountStatus | 'all') ?? 'all',
      sortField: 'name',
      sortDirection: 'asc',
      page,
      pageSize: PAGE_SIZE,
    })
    if (accountsResult.error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p>Failed to load accounts: {accountsResult.error}</p>
        </div>
      )
    }
    return (
      <AccountingClient
        currentTab="accounts"
        canWrite={canWrite}
        pageSize={PAGE_SIZE}
        accountsData={accountsResult.data}
        accountsTotalCount={accountsResult.totalCount}
        accountsPage={page}
        initialAccountsSearch={params.search ?? ''}
        initialAccountsStatus={(params.status as AccountStatus | 'all') ?? 'all'}
      />
    )
  }

  const categoriesResult = await getCategoriesPage({
    search: params.search,
    type: (params.type as CategoryType | 'all') ?? 'all',
    status: (params.status as CategoryStatus | 'all') ?? 'all',
    sortField: 'name',
    sortDirection: 'asc',
    page,
    pageSize: PAGE_SIZE,
  })
  if (categoriesResult.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Failed to load categories: {categoriesResult.error}</p>
      </div>
    )
  }
  return (
    <AccountingClient
      currentTab="categories"
      canWrite={canWrite}
      pageSize={PAGE_SIZE}
      categoriesData={categoriesResult.data}
      categoriesTotalCount={categoriesResult.totalCount}
      categoriesPage={page}
      initialCategoriesSearch={params.search ?? ''}
      initialCategoriesType={(params.type as CategoryType | 'all') ?? 'all'}
      initialCategoriesStatus={(params.status as CategoryStatus | 'all') ?? 'all'}
    />
  )
}
