'use client'

import { EmptyState } from '@/app/components/empty-state'
import type { EntryListItem, EntryType } from '@/lib/accounting/actions'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatAmount(amount: number, type: EntryType) {
  const n = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return type === 'income' ? `+${n}` : `-${n}`
}

interface AccountingEntriesTableProps {
  entries: EntryListItem[]
  canWrite: boolean
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function AccountingEntriesTable({ entries, canWrite, onEdit, onDelete }: AccountingEntriesTableProps) {
  if (entries.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center pt-16 pb-8">
        <EmptyState
          title="No entries"
          description="Add an income or expense entry to get started."
        />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Date</th>
            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Type</th>
            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Account</th>
            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Category</th>
            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Project</th>
            <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Amount</th>
            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Remarks</th>
            {canWrite && (
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {entries.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50/50">
              <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-[#1E1B4B]">{formatDate(row.entry_date)}</td>
              <td className="whitespace-nowrap px-3 sm:px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    row.entry_type === 'income'
                      ? 'bg-[rgba(22,163,74,0.08)] text-[#15803D] border-[rgba(22,163,74,0.4)]'
                      : 'bg-[rgba(220,38,38,0.06)] text-[#B91C1C] border-[rgba(220,38,38,0.4)]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${row.entry_type === 'income' ? 'bg-[#22C55E]' : 'bg-[#F97373]'}`} />
                  {row.entry_type === 'income' ? 'Income' : 'Expense'}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-[#1E1B4B]">{row.account_name}</td>
              <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-[#1E1B4B]">{row.category_name}</td>
              <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm text-slate-600 max-w-[140px] truncate" title={row.project_name ?? undefined}>
                {row.project_name ?? '—'}
              </td>
              <td
                className={`whitespace-nowrap px-3 sm:px-4 py-3 text-sm font-medium text-right ${
                  row.entry_type === 'income' ? 'text-[#15803D]' : 'text-[#B91C1C]'
                }`}
              >
                {formatAmount(row.amount, row.entry_type)}
              </td>
              <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={row.remarks ?? undefined}>
                {row.remarks ?? '—'}
              </td>
              {canWrite && (
                <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(row.id)}
                      className="rounded-lg px-2 py-1.5 text-sm font-medium text-[#06B6D4] transition-colors hover:bg-cyan-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(row.id)}
                      className="rounded-lg px-2 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
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
