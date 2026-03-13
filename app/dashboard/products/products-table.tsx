import Image from 'next/image'
import { EmptyState } from '@/app/components/empty-state'
import { Tooltip } from '@/app/components/ui/tooltip'
import type { ProductListItem } from '@/lib/products/actions'

interface ProductsTableProps {
  products: ProductListItem[]
  onManageClients: (product: ProductListItem) => void
  onEdit: (productId: string) => void
  onDelete: (productId: string, productName: string) => void
  isFiltered?: boolean
}

function formatClientCount(count: number) {
  return `${count}`
}

export function ProductsTable({
  products,
  onManageClients,
  onEdit,
  onDelete,
  isFiltered = false,
}: ProductsTableProps) {
  if (products.length === 0) {
    return (
      <div className="flex h-full w-full min-h-[400px] items-center justify-center bg-white">
        <div className="w-full max-w-lg">
          <EmptyState
            variant={isFiltered ? 'search' : 'projects'}
            title={isFiltered ? 'No products found' : 'No products yet'}
            description={
              isFiltered
                ? 'Try adjusting your search.'
                : 'Create your first product to get started.'
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-white">
      <table className="w-full table-fixed divide-y divide-gray-100">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="bg-gray-50/50">
            <th className="w-[40%] px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Product
            </th>
            <th className="hidden md:table-cell md:w-[35%] px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Description
            </th>
            <th className="w-[10%] px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Active
            </th>
            <th className="w-[10%] px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Expired
            </th>
            <th className="w-[15%] px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {products.map((product) => (
            <tr
              key={product.id}
              className="group cursor-pointer transition-all duration-200 hover:bg-slate-50"
              onClick={() => onManageClients(product)}
            >
              <td className="px-3 sm:px-4 py-3">
                <div className="flex items-center gap-3">
                  {product.icon_url ? (
                    <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200/80 shadow-sm">
                      <Image
                        src={product.icon_url}
                        alt={product.name}
                        fill
                        className="object-contain p-0.5"
                        sizes="36px"
                      />
                    </span>
                  ) : (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white shadow-sm ring-2 ring-white">
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span
                      className="line-clamp-2 break-words text-sm sm:text-base font-semibold text-gray-900 leading-snug"
                      title={product.name}
                    >
                      {product.name}
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                      {product.is_annual_subscription ? 'Annual subscription' : 'Non-annual'}
                    </span>
                  </div>
                </div>
              </td>
              <td className="hidden md:table-cell px-3 sm:px-4 py-3 align-top">
                {product.description ? (
                  <span
                    className="text-sm text-gray-600"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                    title={product.description}
                  >
                    {product.description}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 sm:px-4 py-3 align-top">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {formatClientCount(product.active_client_count)}
                </span>
              </td>
              <td className="px-3 sm:px-4 py-3 align-top">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {formatClientCount(product.expired_client_count)}
                </span>
              </td>
              <td
                className="px-3 sm:px-4 py-3 text-right text-sm align-top"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-end gap-1">
                  <Tooltip content="Edit product" position="left">
                    <button
                      type="button"
                      onClick={() => onEdit(product.id)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
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
                  <Tooltip content="Delete product" position="left">
                    <button
                      type="button"
                      onClick={() => onDelete(product.id, product.name)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

