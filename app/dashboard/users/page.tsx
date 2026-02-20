import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { getUsers } from '@/lib/users/actions'
import UsersClient from './users-client'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'

const PAGE_SIZE = 20

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string; status?: string; page?: string }>
}) {
  const currentUser = await requireAuth()
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'read')

  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'write')
  const canCreate = currentUser.role === 'admin'
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const result = await getUsers({
    search: params.search,
    role: params.role,
    status: params.status,
    page,
    pageSize: PAGE_SIZE,
  })

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Failed to load users: {result.error}</p>
      </div>
    )
  }

  return (
    <UsersClient
      initialUsers={result.data || []}
      totalCount={result.totalCount ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      canWrite={canWrite}
      canCreate={canCreate}
    />
  )
}
