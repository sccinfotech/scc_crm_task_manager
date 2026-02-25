'use client'

import { memo } from 'react'
import { UserData } from '@/lib/users/actions'
import { EmptyState } from '@/app/components/empty-state'
import { Tooltip } from '@/app/components/ui/tooltip'

interface UsersTableProps {
  users: UserData[]
  canWrite: boolean
  onRowClick: (user: UserData) => void
  onEdit: (user: UserData) => void
  onManagePermissions: (user: UserData) => void
}

const StatusPill = memo(function StatusPill({ status }: { status: boolean }) {
  const style = status
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-600', ring: 'ring-emerald-600/20' }
    : { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-600', ring: 'ring-red-600/20' }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${style.bg} ${style.text} ring-1 ring-inset ${style.ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`}></span>
      {status ? 'Active' : 'Inactive'}
    </span>
  )
})

function RolePill({ role }: { role: string }) {
  const styles = {
    admin: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-600/20' },
    manager: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-600/20' },
    staff: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-600/20' },
    client: { bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-600/20' },
  }

  const style = styles[role as keyof typeof styles] || styles.staff

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium capitalize ${style.bg} ${style.text} ring-1 ring-inset ${style.ring}`}
    >
      {role}
    </span>
  )
}

function UserAvatar({ user }: { user: UserData }) {
  if (user.photo_url) {
    return (
      <img
        src={user.photo_url}
        alt={user.full_name || user.email}
        className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover shadow-sm ring-2 ring-white"
      />
    )
  }

  return (
    <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs sm:text-sm font-bold text-white shadow-sm flex-shrink-0 ring-2 ring-white">
      {user.full_name?.substring(0, 2).toUpperCase() || 'U'}
    </div>
  )
}

export const UsersTable = memo(function UsersTable({ users, canWrite, onRowClick, onEdit, onManagePermissions }: UsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="flex h-full w-full min-h-[500px] items-center justify-center bg-white">
        <div className="w-full max-w-lg">
          <EmptyState
            variant="users"
            title="No users found"
            description="Add a new user to get started."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-white">
      <div className="flex flex-col gap-3 p-3 sm:p-4 md:hidden">
        {users.map((user) => (
          <article
            key={user.id}
            className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md"
            onClick={() => onRowClick(user)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar user={user} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{user.full_name || user.email}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                  <p className="truncate text-xs text-slate-500">{user.designation || '-'}</p>
                </div>
              </div>
              {canWrite && (
                <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                  <Tooltip content="Edit user details" position="left">
                    <button
                      type="button"
                      onClick={() => onEdit(user)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </Tooltip>
                  <Tooltip content="Set module permissions" position="left">
                    <button
                      type="button"
                      onClick={() => onManagePermissions(user)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                    >
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>

            <p className="mt-2 text-sm font-medium text-slate-600">
              Mobile:{' '}
              {user.personal_mobile_no ? (
                <a
                  href={`tel:${user.personal_mobile_no}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  {user.personal_mobile_no}
                </a>
              ) : (
                <span className="text-slate-500">-</span>
              )}
            </p>

            <div className="mt-3 flex items-center justify-between gap-2">
              <RolePill role={user.role} />
              <StatusPill status={user.is_active} />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden h-full md:block">
        <table className="w-full table-fixed divide-y divide-gray-100">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="bg-gray-50/50">
              <th className="w-[45%] sm:w-[25%] px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                User
              </th>
              <th className="hidden sm:table-cell sm:w-[20%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Designation
              </th>
              <th className="hidden sm:table-cell sm:w-[17%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Mobile
              </th>
              <th className="w-[20%] sm:w-[12%] px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="w-[17%] sm:w-[12%] px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="w-[18%] sm:w-[14%] px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                {canWrite ? 'Actions' : 'View'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {users.map((user) => (
              <tr
                key={user.id}
                className="group transition-all duration-200 hover:bg-slate-50 cursor-pointer"
                onClick={() => onRowClick(user)}
              >
                <td className="px-4 sm:px-4 py-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <UserAvatar user={user} />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm sm:text-base font-semibold text-gray-900 leading-tight">{user.full_name || user.email}</span>
                      <span className="truncate text-xs text-slate-500 mt-0.5">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td className="hidden sm:table-cell px-4 py-3">
                  <div className="truncate text-sm text-gray-500">{user.designation || '-'}</div>
                </td>
                <td className="hidden sm:table-cell px-4 py-3">
                  <div className="truncate text-sm">
                    {user.personal_mobile_no ? (
                      <a
                        href={`tel:${user.personal_mobile_no}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        {user.personal_mobile_no}
                      </a>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </div>
                </td>
                <td className="px-4 sm:px-4 py-3 text-sm">
                  <RolePill role={user.role} />
                </td>
                <td className="px-4 sm:px-4 py-3 text-sm">
                  <StatusPill status={user.is_active} />
                </td>
                <td className="px-4 sm:px-4 py-3 text-right text-sm" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {canWrite && (
                      <>
                        <Tooltip content="Edit user details" position="left">
                          <button
                            type="button"
                            onClick={() => onEdit(user)}
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </Tooltip>

                        <Tooltip content="Set module permissions" position="left">
                          <button
                            type="button"
                            onClick={() => onManagePermissions(user)}
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                          >
                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                          </button>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
})
