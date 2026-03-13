'use client'

import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { ProductListItem } from '@/lib/products/actions'
import { Tooltip } from '@/app/components/ui/tooltip'
import { ProductClientsSection } from './product-clients-section'

type ProductDetailTab = 'details' | 'clients'

const PRODUCT_DETAIL_TABS: { id: ProductDetailTab; label: string }[] = [
  { id: 'details', label: 'Product details' },
  { id: 'clients', label: 'Clients' },
]

function parseProductDetailTab(value: string | null | undefined): ProductDetailTab | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return PRODUCT_DETAIL_TABS.some((tab) => tab.id === normalized)
    ? (normalized as ProductDetailTab)
    : null
}

interface ProductDetailViewProps {
  product: ProductListItem
  clients: ClientSelectOption[]
  canWrite: boolean
  initialTab?: string | null
}

export function ProductDetailView({
  product: initialProduct,
  clients,
  canWrite,
  initialTab,
}: ProductDetailViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const resolvedInitialTab: ProductDetailTab =
    parseProductDetailTab(initialTab) ?? 'details'

  const [product] = useState<ProductListItem>(initialProduct)
  const [activeTab, setActiveTab] = useState<ProductDetailTab>(resolvedInitialTab)

  const updateTabInUrl = useCallback(
    (tab: ProductDetailTab) => {
      const params = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.search : searchParams.toString()
      )
      params.set('tab', tab)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    const nextTab = parseProductDetailTab(searchParams.get('tab')) ?? 'details'
    setActiveTab((current) => (current === nextTab ? current : nextTab))
  }, [searchParams])

  const handleTabChange = (nextTab: ProductDetailTab) => {
    if (nextTab === activeTab) return
    setActiveTab(nextTab)
    updateTabInUrl(nextTab)
  }

  const hasLogo = Boolean(product.icon_url)

  return (
    <div className="flex h-full flex-col gap-2 sm:gap-3">
      <div className="flex-shrink-0 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div
            className="flex items-stretch overflow-x-auto scrollbar-hide"
            role="tablist"
            aria-label="Product detail tabs"
          >
            {PRODUCT_DETAIL_TABS.map(({ id, label }, index) => {
              const isActive = activeTab === id
              const isLast = index === PRODUCT_DETAIL_TABS.length - 1
              return (
                <div key={id} className="flex items-stretch">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleTabChange(id)}
                    className={`
                      relative px-2.5 pb-2 pt-1 text-sm font-semibold whitespace-nowrap transition-colors duration-200 cursor-pointer
                      border-b-2
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white
                      ${
                        isActive
                          ? 'text-[#06B6D4] border-[#06B6D4]'
                          : 'text-slate-600 border-transparent hover:text-slate-800'
                      }
                    `}
                  >
                    {label}
                  </button>
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className="mx-2 w-px self-stretch bg-gradient-to-b from-slate-200/0 via-slate-200/70 to-slate-200/0 sm:mx-3"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'details' && (
          <div className="flex h-full flex-col gap-3 overflow-y-auto">
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200">
              <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  {hasLogo ? (
                    <span className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 shadow-sm ring-1 ring-slate-200/80">
                      <Image
                        src={product.icon_url!}
                        alt={product.name}
                        fill
                        className="object-contain p-1"
                        sizes="48px"
                      />
                    </span>
                  ) : (
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-base font-bold text-white shadow-sm ring-2 ring-white">
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1
                      className="truncate text-lg font-extrabold text-[#1E1B4B] sm:text-xl"
                      title={product.name}
                    >
                      {product.name}
                    </h1>
                    <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                      {product.is_annual_subscription ? 'Annual subscription' : 'Non-annual product'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Description
                  </h3>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">
                    {product.description?.trim() || 'No description provided.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clients' && (
          <ProductClientsSection product={product} clients={clients} canWrite={canWrite} />
        )}
      </div>
    </div>
  )
}

