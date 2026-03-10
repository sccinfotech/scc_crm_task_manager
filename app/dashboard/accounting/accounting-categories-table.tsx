'use client'

import { EmptyState } from '@/app/components/empty-state'
import type { CategoryListItem, CategoryType, CategoryStatus } from '@/lib/accounting/actions'

interface AccountingCategoriesTableProps {
  categories: CategoryListItem[]
  canWrite: boolean
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function AccountingCategoriesTable({ categories, canWrite, onEdit, onDelete }: AccountingCategoriesTableProps) {
  if (categories.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center pt-16 pb-8">
        <EmptyState
          title="No categories"
          description="Add an income or expense category to organize entries."
        />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Category Name</th>
            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Type</th>
            <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Status</th>
            {canWrite && (
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {categories.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50/50">
              <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-sm font-medium text-[#1E1B4B]">{row.name}</td>
              <td className="whitespace-nowrap px-3 sm:px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    row.type === 'income'
                      ? 'bg-[rgba(22,163,74,0.08)] text-[#15803D] border-[rgba(22,163,74,0.4)]'
                      : 'bg-[rgba(220,38,38,0.06)] text-[#B91C1C] border-[rgba(220,38,38,0.4)]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${row.type === 'income' ? 'bg-[#22C55E]' : 'bg-[#F97373]'}`} />
                  {row.type === 'income' ? 'Income' : 'Expense'}
                </span>
              </td>
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
