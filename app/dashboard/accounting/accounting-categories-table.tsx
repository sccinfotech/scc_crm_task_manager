'use client'

import { EmptyState } from '@/app/components/empty-state'
import { Tooltip } from '@/app/components/ui/tooltip'
import type { CategoryListItem } from '@/lib/accounting/actions'

interface AccountingCategoriesTableProps {
  categories: CategoryListItem[]
  canWrite: boolean
  onEdit: (category: CategoryListItem) => void
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
    <>
      <ul className="list-none space-y-3 p-3 md:hidden" aria-label="Categories list">
        {categories.map((row) => (
          <li key={row.id}>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold text-[#1E1B4B]">{row.name}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    row.type === 'income'
                      ? 'bg-[rgba(22,163,74,0.08)] text-[#15803D] border-[rgba(22,163,74,0.4)]'
                      : 'bg-[rgba(220,38,38,0.06)] text-[#B91C1C] border-[rgba(220,38,38,0.4)]'
                  }`}
                >
                  {row.type === 'income' ? 'Income' : 'Expense'}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    row.status === 'active'
                      ? 'bg-[rgba(22,163,74,0.08)] text-[#15803D] border-[rgba(22,163,74,0.4)]'
                      : 'bg-[rgba(220,38,38,0.06)] text-[#B91C1C] border-[rgba(220,38,38,0.4)]'
                  }`}
                >
                  {row.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              {canWrite && (
                <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-3">
                  <Tooltip content="Edit category" position="top">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                      aria-label="Edit category"
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
                  <Tooltip content="Delete category" position="top">
                    <button
                      type="button"
                      onClick={() => onDelete(row.id)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete category"
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
                    <Tooltip content="Edit category" position="left">
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        aria-label="Edit category"
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
                    <Tooltip content="Delete category" position="left">
                      <button
                        type="button"
                        onClick={() => onDelete(row.id)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete category"
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
