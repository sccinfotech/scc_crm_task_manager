'use client'

import { EmptyState } from '@/app/components/empty-state'
import { Tooltip } from '@/app/components/ui/tooltip'
import type { AccountListItem, AccountStatus } from '@/lib/accounting/actions'

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface AccountingAccountsTableProps {
  accounts: AccountListItem[]
  canWrite: boolean
  onView?: (account: AccountListItem) => void
  onEdit: (account: AccountListItem) => void
  onDelete: (id: string) => void
}

export function AccountingAccountsTable({ accounts, canWrite, onView, onEdit, onDelete }: AccountingAccountsTableProps) {
  if (accounts.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center pt-16 pb-8">
        <EmptyState
          title="No accounts"
          description="Add an account to start tracking balances."
        />
      </div>
    )
  }

  return (
    <>
      <ul className="list-none space-y-3 p-3 md:hidden" aria-label="Accounts list">
        {accounts.map((row) => (
          <li key={row.id}>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {onView ? (
                    <button
                      type="button"
                      onClick={() => onView(row)}
                      className="text-left text-base font-semibold text-[#06B6D4] hover:underline"
                    >
                      {row.name}
                    </button>
                  ) : (
                    <h3 className="text-base font-semibold text-[#1E1B4B]">{row.name}</h3>
                  )}
                  {row.is_default && (
                    <span className="mt-1 inline-flex rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-200">
                      Default
                    </span>
                  )}
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    row.status === 'active'
                      ? 'bg-[rgba(22,163,74,0.08)] text-[#15803D] border-[rgba(22,163,74,0.4)]'
                      : 'bg-[rgba(220,38,38,0.06)] text-[#B91C1C] border-[rgba(220,38,38,0.4)]'
                  }`}
                >
                  {row.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <dt className="text-[10px] font-medium text-slate-500">Opening</dt>
                  <dd className="font-medium text-[#1E1B4B]">{formatMoney(row.opening_balance)}</dd>
                </div>
                <div className="rounded-lg bg-emerald-50/60 px-2 py-1.5">
                  <dt className="text-[10px] font-medium text-emerald-800">Total in</dt>
                  <dd className="font-medium text-[#15803D]">{formatMoney(row.total_in)}</dd>
                </div>
                <div className="rounded-lg bg-rose-50/60 px-2 py-1.5">
                  <dt className="text-[10px] font-medium text-rose-800">Total out</dt>
                  <dd className="font-medium text-[#B91C1C]">{formatMoney(row.total_out)}</dd>
                </div>
                <div className="rounded-lg bg-cyan-50/60 px-2 py-1.5">
                  <dt className="text-[10px] font-medium text-cyan-900">Current</dt>
                  <dd className="font-semibold text-[#1E1B4B]">{formatMoney(row.current_balance)}</dd>
                </div>
              </dl>
              {canWrite && (
                <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-3">
                  <Tooltip content="Edit account" position="top">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                      aria-label="Edit account"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete account" position="top">
                    <button
                      type="button"
                      onClick={() => onDelete(row.id)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete account"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </Tooltip>
                </div>
              )}
            </article>
          </li>
        ))}
      </ul>

      <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Account Name</th>
            <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Opening Balance</th>
            <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Total In</th>
            <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Total Out</th>
            <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Current Balance</th>
            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Status</th>
            {canWrite && (
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {accounts.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50/50">
              <td className="whitespace-nowrap px-3 sm:px-4 py-3">
                <div className="flex items-center gap-2">
                  {onView ? (
                    <button
                      type="button"
                      onClick={() => onView(row)}
                      className="text-sm font-medium text-[#06B6D4] hover:underline"
                    >
                      {row.name}
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-[#1E1B4B]">{row.name}</span>
                  )}
                  {row.is_default && (
                    <span className="inline-flex items-center rounded-full bg-cyan-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 border border-cyan-200">
                      Default
                    </span>
                  )}
                </div>
              </td>
              {/* Default indicator moved into Account Name cell */}
              <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-right text-[#1E1B4B]">{formatMoney(row.opening_balance)}</td>
              <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-right text-[#15803D]">{formatMoney(row.total_in)}</td>
              <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-right text-[#B91C1C]">{formatMoney(row.total_out)}</td>
              <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-right font-medium text-[#1E1B4B]">{formatMoney(row.current_balance)}</td>
              <td className="whitespace-nowrap px-3 sm:px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    row.status === 'active'
                      ? 'bg-[rgba(22,163,74,0.08)] text-[#15803D] border-[rgba(22,163,74,0.4)]'
                      : 'bg-[rgba(220,38,38,0.06)] text-[#B91C1C] border-[rgba(220,38,38,0.4)]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'active' ? 'bg-[#22C55E]' : 'bg-[#F97373]'}`} />
                  {row.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </td>
              {canWrite && (
                <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip content="Edit account" position="left">
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        aria-label="Edit account"
                      >
                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    </Tooltip>
                    <Tooltip content="Delete account" position="left">
                      <button
                        type="button"
                        onClick={() => onDelete(row.id)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete account"
                      >
                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </Tooltip>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  )
}
