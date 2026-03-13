'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { ProductFormData, ProductListItem } from '@/lib/products/actions'
import { createProduct, updateProduct, deleteProduct } from '@/lib/products/actions'
import { SidebarToggleButton } from '@/app/components/dashboard/sidebar-context'
import { Pagination } from '@/app/components/ui/pagination'
import { useToast } from '@/app/components/ui/toast-context'
import { ProductsTable } from './products-table'
import { ProductsFilters } from './products-filters'
import { ProductModal } from './product-modal'
import { DeleteConfirmModal } from './products-delete-modal'

interface ProductsClientProps {
  products: ProductListItem[]
  totalCount: number
  page: number
  pageSize: number
  initialSearch: string
  canWrite: boolean
  clients: ClientSelectOption[]
  clientsError: string | null
}

export function ProductsClient({
  products,
  totalCount,
  page,
  pageSize,
  initialSearch,
  canWrite,
  clients,
  clientsError,
}: ProductsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { success: showSuccess, error: showError } = useToast()

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [deleteProductName, setDeleteProductName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [mobileProducts, setMobileProducts] = useState<ProductListItem[]>(products)
  const [mobilePage, setMobilePage] = useState(page)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    setMobileProducts(products)
    setMobilePage(page)
  }, [products, page, initialSearch])

  const buildSearchParams = useCallback(
    (updates: { search?: string; page?: number }) => {
      const params = new URLSearchParams()
      const search = updates.search !== undefined ? updates.search : initialSearch
      const pageNum = updates.page !== undefined ? updates.page : page
      if (search) params.set('search', search)
      if (pageNum > 1) params.set('page', String(pageNum))
      return params.toString()
    },
    [initialSearch, page]
  )

  const handleCreate = async (formData: ProductFormData) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to create products.')
      return { error: 'Permission denied' }
    }
    setLoading(true)
    const result = await createProduct(formData)
    setLoading(false)
    if (!result.error) {
      showSuccess('Product Created', `"${formData.name}" has been created successfully.`)
      router.refresh()
      setCreateModalOpen(false)
    } else {
      showError('Creation Failed', result.error)
    }
    return result
  }

  const handleUpdate = async (formData: ProductFormData) => {
    if (!selectedProductId) return { error: 'No product selected' }
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to update products.')
      return { error: 'Permission denied' }
    }
    setLoading(true)
    const result = await updateProduct(selectedProductId, formData)
    setLoading(false)
    if (!result.error) {
      showSuccess('Product Updated', `"${formData.name}" has been updated successfully.`)
      router.refresh()
      setEditModalOpen(false)
      setSelectedProductId(null)
    } else {
      showError('Update Failed', result.error)
    }
    return result
  }

  const handleManageClients = (product: ProductListItem) => {
    router.push(`/dashboard/products/${product.id}?tab=clients`)
  }

  const handleEdit = (productId: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to edit products.')
      return
    }
    setSelectedProductId(productId)
    setEditModalOpen(true)
  }

  const handleDelete = (productId: string, productName: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to delete products.')
      return
    }
    setSelectedProductId(productId)
    setDeleteProductName(productName)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedProductId) return
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to delete products.')
      return
    }

    setDeleting(true)
    const result = await deleteProduct(selectedProductId)
    setDeleting(false)

    if (!result.error) {
      showSuccess('Product Deleted', `"${deleteProductName}" has been removed successfully.`)
      setDeleteModalOpen(false)
      setSelectedProductId(null)
      setDeleteProductName('')
      router.refresh()
    } else {
      showError('Delete Failed', result.error || 'Failed to delete product')
    }
  }

  const handleCloseDelete = () => {
    setDeleteModalOpen(false)
    setSelectedProductId(null)
    setDeleteProductName('')
  }

  const handleFilterChange = (updates: { search?: string }) => {
    const q = buildSearchParams({ search: updates.search, page: 1 })
    router.push(`${pathname}${q ? `?${q}` : ''}`)
  }

  const handleClearFilters = () => {
    router.push(pathname)
  }

  const handlePageChange = (newPage: number) => {
    const q = buildSearchParams({ page: newPage })
    router.push(`${pathname}${q ? `?${q}` : ''}`)
  }

  const handleRefresh = () => {
    router.refresh()
  }

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || mobileProducts.length >= totalCount) return
    setLoadingMore(true)
    // Reuse server page route by pushing next page; for mobile infinite scroll we simply rely on server pagination
    const nextPage = mobilePage + 1
    const q = buildSearchParams({ page: nextPage })
    router.push(`${pathname}${q ? `?${q}` : ''}`)
    setLoadingMore(false)
  }, [loadingMore, mobileProducts.length, totalCount, mobilePage, buildSearchParams, pathname, router])

  const getInitialEditData = (): ProductFormData | undefined => {
    if (!selectedProductId) return undefined
    const product = products.find((p) => p.id === selectedProductId)
    if (!product) return undefined
    return {
      name: product.name,
      description: product.description || '',
      icon_url: product.icon_url || '',
      is_annual_subscription: product.is_annual_subscription,
      subscriptions: [],
    }
  }

  return (
    <>
      <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SidebarToggleButton />
            <h1 className="text-2xl font-semibold text-[#1E1B4B]">Products</h1>
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
              onClick={() => setCreateModalOpen(true)}
              disabled={!canWrite}
              title={canWrite ? 'Create product' : 'Read-only access'}
              className={`btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${!canWrite ? 'hover:shadow-lg hover:-translate-y-0' : ''}`}
            >
              Create Product
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col">
          <ProductsFilters
            searchQuery={initialSearch}
            onSearchChange={(q) => handleFilterChange({ search: q })}
            onClearFilters={handleClearFilters}
          />

          {loading && (
            <div className="border-b border-gray-200 bg-blue-50 px-6 py-3">
              <p className="text-sm text-blue-800">Loading...</p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <div className="h-full">
              <ProductsTable
                products={products}
                onManageClients={handleManageClients}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isFiltered={initialSearch.trim() !== ''}
              />
            </div>
          </div>
          <Pagination
            currentPage={page}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            className="hidden md:flex"
          />
        </div>
      </div>

      <ProductModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        mode="create"
        onSubmit={handleCreate}
        clients={clients}
        clientsError={clientsError}
      />

      <ProductModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setSelectedProductId(null)
        }}
        mode="edit"
        initialData={getInitialEditData()}
        onSubmit={handleUpdate}
        clients={clients}
        clientsError={clientsError}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        productName={deleteProductName}
        isLoading={deleting}
      />
    </>
  )
}

