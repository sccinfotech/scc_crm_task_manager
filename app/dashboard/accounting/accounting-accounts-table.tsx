'use client'

import { EmptyState } from '@/app/components/empty-state'
import type { AccountListItem, AccountStatus } from '@/lib/accounting/actions'

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface AccountingAccountsTableProps {
  accounts: AccountListItem[]
  canWrite: boolean
  onView?: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function AccountingAccountsTable({ accounts, canWrite, onView, onEdit, onDelete }: AccountingAccountsTableProps) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        title="No accounts"
        description="Add an account to start tracking balances."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
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
                {onView ? (
                  <button
                    type="button"
                    onClick={() => onView(row.id)}
                    className="text-sm font-medium text-[#06B6D4] hover:underline"
                  >
                    {row.name}
                  </button>
                ) : (
                  <span className="text-sm font-medium text-[#1E1B4B]">{row.name}</span>
                )}
              </td>
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
                    <button
                      type="button"
                      onClick={() => onEdit(row.id)}
                      className="rounded-lg px-2 py-1.5 text-sm font-medium text-[#06B6D4] hover:bg-cyan-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(row.id)}
                      className="rounded-lg px-2 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
