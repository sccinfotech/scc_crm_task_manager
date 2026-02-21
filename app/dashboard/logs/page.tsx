import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { LogsClient } from './logs-client'
import { getActivityLogsPage } from '@/lib/activity-log/actions'
import { getStaffForSelect } from '@/lib/users/actions'

const PAGE_SIZE = 20

function getDefaultDateRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 30)
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  }
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    fromDate?: string
    toDate?: string
    user?: string
    actionType?: string
    module?: string
    status?: string
    search?: string
    sort?: string
    sortDir?: 'asc' | 'desc'
    page?: string
  }>
}) {
  const user = await requireAuth()
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.logs, 'read')
  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.logs, 'write')

  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const defaultRange = getDefaultDateRange()
  const params = await searchParams
  const fromDate = params.fromDate?.trim() || defaultRange.fromDate
  const toDate = params.toDate?.trim() || defaultRange.toDate
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const [result, staffResult] = await Promise.all([
    getActivityLogsPage({
      fromDate,
      toDate,
      userId: params.user?.trim() || null,
      actionType: (params.actionType as 'Create' | 'Update' | 'Delete' | 'Login' | 'Logout') || null,
      moduleName: params.module?.trim() || null,
      status: (params.status as 'Success' | 'Failed' | 'all') || 'all',
      search: params.search?.trim() || null,
      sortField:
        (params.sort as 'created_at' | 'user_name' | 'action_type' | 'module_name' | 'status') ||
        'created_at',
      sortDirection: params.sortDir ?? 'desc',
      page,
      pageSize: PAGE_SIZE,
    }),
    getStaffForSelect(),
  ])

  const staffOptions = staffResult.data ?? []

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Failed to load activity logs: {result.error}</p>
      </div>
    )
  }

  return (
    <LogsClient
      logs={result.data}
      totalCount={result.totalCount}
      page={page}
      pageSize={PAGE_SIZE}
      initialFromDate={fromDate}
      initialToDate={toDate}
      initialUserId={params.user ?? ''}
      initialActionType={params.actionType ?? ''}
      initialModuleName={params.module ?? ''}
      initialStatus={(params.status as 'Success' | 'Failed' | 'all') ?? 'all'}
      initialSearch={params.search ?? ''}
      initialSortField={(params.sort as 'created_at' | 'user_name' | 'action_type' | 'module_name' | 'status') ?? 'created_at'}
      initialSortDirection={params.sortDir ?? 'desc'}
      staffOptions={staffOptions}
      canWrite={canWrite}
    />
  )
}
