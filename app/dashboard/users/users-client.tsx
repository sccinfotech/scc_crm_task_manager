'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { UsersFilters } from '@/app/components/users/users-filters'
import { UsersTable } from '@/app/components/users/users-table'
import { UserModal } from '@/app/components/users/user-modal'
import { ChangePasswordModal } from '@/app/components/users/change-password-modal'
import { UserDeleteModal } from '@/app/components/users/user-delete-modal'
import { Pagination } from '@/app/components/ui/pagination'
import { SidebarToggleButton } from '@/app/components/dashboard/sidebar-context'
import { UserData, UserRole, createUser, updateUser, deleteUser } from '@/lib/users/actions'
import { useToast } from '@/app/components/ui/toast-context'

interface UsersClientProps {
    initialUsers: UserData[]
    totalCount: number
    page: number
    pageSize: number
    currentUserId: string
    canWrite: boolean
}

export default function UsersClient({ initialUsers, totalCount, page, pageSize, currentUserId, canWrite }: UsersClientProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
    const { success: showSuccess, error: showError } = useToast()

    const currentSearch = searchParams.get('search') || ''
    const currentRole = (searchParams.get('role') as UserRole) || 'all'

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [selectedUser, setSelectedUser] = useState<UserData | undefined>(undefined)
    const [isReadOnlyModal, setIsReadOnlyModal] = useState(false)

    // Password Modal State
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
    const [userForPassword, setUserForPassword] = useState<UserData | undefined>(undefined)

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [userToDelete, setUserToDelete] = useState<UserData | undefined>(undefined)

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

    // Handlers
    const handleCreateOpen = () => {
        if (!canWrite) {
            showError('Read-only Access', 'You do not have permission to add users.')
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

    const handleChangePasswordOpen = (user: UserData) => {
        if (!canWrite) {
            showError('Read-only Access', 'You do not have permission to change passwords.')
            return
        }
        setUserForPassword(user)
        setIsPasswordModalOpen(true)
    }

    const handleDeleteOpen = (user: UserData) => {
        if (!canWrite) {
            showError('Read-only Access', 'You do not have permission to deactivate users.')
            return
        }
        setUserToDelete(user)
        setIsDeleteModalOpen(true)
    }

    const confirmDelete = async () => {
        if (!userToDelete) return { error: 'No user selected' }
        if (!canWrite) {
            showError('Read-only Access', 'You do not have permission to deactivate users.')
            return { error: 'Permission denied' }
        }
        const result = await deleteUser(userToDelete.id)
        if (result.success) {
            showSuccess('User Deleted', `${userToDelete.full_name || userToDelete.email} has been removed successfully.`)
            router.refresh()
            return { success: true }
        }
        showError('Delete Failed', result.error || 'Could not delete user.')
        return { error: result.error || 'Failed to delete user' }
    }

    const handleModalSubmit = async (formData: any) => {
        if (!canWrite) {
            showError('Read-only Access', 'You do not have permission to update users.')
            return { error: 'Permission denied', success: false }
        }
        if (modalMode === 'create') {
            const result = await createUser(formData)
            if (result.error) {
                showError('Creation Failed', result.error)
                return { error: result.error, success: false }
            }
            showSuccess('User Created', `${formData.full_name} has been added successfully.`)
        } else {
            if (!selectedUser) return { error: 'No user selected' }
            const result = await updateUser(selectedUser.id, formData)
            if (result.error) {
                showError('Update Failed', result.error)
                return { error: result.error, success: false }
            }
            showSuccess('User Updated', `${formData.full_name || selectedUser.full_name} has been updated.`)
        }

        // Success
        setIsModalOpen(false)
        setIsReadOnlyModal(false)
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
                        disabled={!canWrite}
                        title={canWrite ? 'Add user' : 'Read-only access'}
                        className={`flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#0891b2] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 active:translate-y-0 ${!canWrite ? 'opacity-50 cursor-not-allowed hover:shadow-lg hover:-translate-y-0' : ''}`}
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                        >
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
                        currentUserId={currentUserId}
                        canWrite={canWrite}
                        onEdit={handleEditOpen}
                        onChangePassword={handleChangePasswordOpen}
                        onDelete={handleDeleteOpen}
                    />
                </div>
                <Pagination
                    currentPage={page}
                    totalCount={totalCount}
                    pageSize={pageSize}
                    onPageChange={handlePageChange}
                />
            </div>

            {/* Modal */}
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

            {/* Change Password Modal */}
            <ChangePasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                user={userForPassword}
            />

            {/* Delete Confirmation Modal */}
            <UserDeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                userName={userToDelete?.full_name || userToDelete?.email || 'this user'}
            />
        </div>
    )
}
