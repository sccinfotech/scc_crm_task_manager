'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { UsersFilters } from '@/app/components/users/users-filters'
import { UsersTable } from '@/app/components/users/users-table'
import { UserModal } from '@/app/components/users/user-modal'
import { UserPermissionsModal } from '@/app/components/users/user-permissions-modal'
import { Pagination } from '@/app/components/ui/pagination'
import { SidebarToggleButton } from '@/app/components/dashboard/sidebar-context'
import {
  UserData,
  UserRole,
  ModulePermissions,
  CreateUserFormData,
  UpdateUserFormData,
  createUser,
  updateUser,
  updateUserPermissions,
} from '@/lib/users/actions'
import { useToast } from '@/app/components/ui/toast-context'

interface UsersClientProps {
  initialUsers: UserData[]
  totalCount: number
  page: number
  pageSize: number
  canWrite: boolean
  canCreate: boolean
}

export default function UsersClient({
  initialUsers,
  totalCount,
  page,
  pageSize,
  canWrite,
  canCreate,
}: UsersClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { success: showSuccess, error: showError } = useToast()

  const currentSearch = searchParams.get('search') || ''
  const currentRole = (searchParams.get('role') as UserRole) || 'all'

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedUser, setSelectedUser] = useState<UserData | undefined>(undefined)
  const [isReadOnlyModal, setIsReadOnlyModal] = useState(false)

  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [userForPermissions, setUserForPermissions] = useState<UserData | undefined>(undefined)

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === 'all' || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    params.delete('page')
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newPage <= 1) params.delete('page')
    else params.set('page', String(newPage))
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleRefresh = () => {
    router.refresh()
  }

  const handleCreateOpen = () => {
    if (!canCreate) {
      showError('Access Restricted', 'Only admins can add users.')
      return
    }
    setModalMode('create')
    setSelectedUser(undefined)
    setIsReadOnlyModal(false)
    setIsModalOpen(true)
  }

  const handleEditOpen = (user: UserData) => {
    setModalMode('edit')
    setSelectedUser(user)
    setIsReadOnlyModal(!canWrite)
    setIsModalOpen(true)
  }

  const handleRowClick = (user: UserData) => {
    const query = searchParams.toString()
    const returnTo = query ? `${pathname}?${query}` : pathname
    const params = new URLSearchParams()
    params.set('returnTo', returnTo)
    params.set('tab', 'assigned-projects')
    router.push(`/dashboard/users/${encodeURIComponent(user.id)}?${params.toString()}`)
  }

  const handleManagePermissionsOpen = (user: UserData) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to set module permissions.')
      return
    }
    setUserForPermissions(user)
    setIsPermissionsModalOpen(true)
  }

  const handleModalSubmit = async (formData: CreateUserFormData | UpdateUserFormData) => {
    if (modalMode === 'create') {
      if (!canCreate) {
        showError('Access Restricted', 'Only admins can add users.')
        return { error: 'Only admins can add users', success: false }
      }

      const createPayload = formData as CreateUserFormData
      const result = await createUser(createPayload)
      if (result.error) {
        showError('Creation Failed', result.error)
        return { error: result.error, success: false }
      }

      showSuccess('User Created', `${createPayload.full_name} has been added successfully.`)
    } else {
      if (!selectedUser) return { error: 'No user selected' }
      if (!canWrite) {
        showError('Read-only Access', 'You do not have permission to update users.')
        return { error: 'Permission denied', success: false }
      }

      const updatePayload = formData as UpdateUserFormData
      const result = await updateUser(selectedUser.id, updatePayload)
      if (result.error) {
        showError('Update Failed', result.error)
        return { error: result.error, success: false }
      }

      showSuccess('User Updated', `${updatePayload.full_name || selectedUser.full_name} has been updated.`)
    }

    setIsModalOpen(false)
    setIsReadOnlyModal(false)
    router.refresh()
    return { success: true }
  }

  const handlePermissionsSubmit = async (permissions: ModulePermissions) => {
    if (!userForPermissions) {
      return { error: 'No user selected', success: false }
    }

    const result = await updateUserPermissions(userForPermissions.id, permissions)
    if (result.error) {
      showError('Update Failed', result.error)
      return { error: result.error, success: false }
    }

    showSuccess('Permissions Updated', `Module permissions updated for ${userForPermissions.full_name || userForPermissions.email}.`)
    setIsPermissionsModalOpen(false)
    setUserForPermissions(undefined)
    router.refresh()
    return { success: true }
  }

  return (
    <div className="flex h-full flex-col p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SidebarToggleButton />
          <h1 className="text-2xl font-bold text-slate-900 font-display">User Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={handleCreateOpen}
            disabled={!canCreate}
            title={canCreate ? 'Add user' : 'Only admins can add users'}
            className={`flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#0891b2] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 active:translate-y-0 ${!canCreate ? 'opacity-50 cursor-not-allowed hover:shadow-lg hover:-translate-y-0' : ''}`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 flex flex-col transition-opacity duration-200 ${isPending ? 'opacity-60' : 'opacity-100'}`}>
        <UsersFilters
          roleFilter={currentRole}
          onRoleChange={(role) => updateFilters({ role })}
          searchQuery={currentSearch}
          onSearchChange={(search) => updateFilters({ search })}
          onClearFilters={() => updateFilters({ search: null, role: null })}
        />

        <div className="flex-1 overflow-y-auto">
          <UsersTable
            users={initialUsers}
            canWrite={canWrite}
            onRowClick={handleRowClick}
            onEdit={handleEditOpen}
            onManagePermissions={handleManagePermissionsOpen}
          />
        </div>

        <Pagination
          currentPage={page}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </div>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setIsReadOnlyModal(false)
        }}
        mode={modalMode}
        initialData={selectedUser}
        readOnly={isReadOnlyModal}
        onSubmit={handleModalSubmit}
      />

      <UserPermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => {
          setIsPermissionsModalOpen(false)
          setUserForPermissions(undefined)
        }}
        user={userForPermissions}
        onSubmit={handlePermissionsSubmit}
      />
    </div>
  )
}
