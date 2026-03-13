'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { createActivityLogEntry } from '@/lib/activity-log/logger'

export type ProductFormData = {
  name: string
  description?: string
  icon_url?: string
  is_annual_subscription: boolean
  subscriptions: {
    client_id: string
    renew_date: string
  }[]
}

export type Product = {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  is_annual_subscription: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export type ProductListItem = {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  is_annual_subscription: boolean
  active_client_count: number
  expired_client_count: number
}

export type ProductClientSubscription = {
  id: string
  product_id: string
  client_id: string
  client_name: string
  client_company_name: string | null
  renew_date: string
}

export type ProductActionResult =
  | { data: Product; error: null }
  | { data: null; error: string }

export type ProductListResult = {
  data: ProductListItem[]
  totalCount: number
  error: string | null
}

export type ProductSubscriptionsResult =
  | { data: ProductClientSubscription[]; error: null }
  | { data: null; error: string }

export type GetProductsPageOptions = {
  search?: string
  page?: number
  pageSize?: number
}

function ensureLoggedIn() {
  // tiny helper to keep error messages consistent if expanded later
  return 'You must be logged in to access products'
}

type CloudinaryUploadSignature = {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  folder: string
}

const PRODUCT_LOGO_CLOUDINARY_FOLDER = 'scc-crm/product-logos'

function getEnvVar(name: string, isPublic = false): string {
  const value = process.env[name]
  if (!value) {
    const visibility = isPublic ? 'public' : 'server-only'
    throw new Error(
      `Missing required ${visibility} environment variable: ${name}. ` +
        'Add it to .env.local and restart the dev server.'
    )
  }
  return value
}

function getCloudinaryConfig() {
  const cloudName = getEnvVar('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', true)
  const apiKey = getEnvVar('NEXT_PUBLIC_CLOUDINARY_API_KEY', true)
  const apiSecret = getEnvVar('CLOUDINARY_API_SECRET', false)

  return { cloudName, apiKey, apiSecret }
}

function signCloudinaryParams(params: Record<string, string | number>, apiSecret: string) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return crypto.createHash('sha1').update(sorted + apiSecret).digest('hex')
}

export async function getProductLogoUploadSignature(): Promise<{
  data: CloudinaryUploadSignature | null
  error: string | null
}> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: ensureLoggedIn() }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.products, 'write')
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager'
  if (!canWrite && !isAdminOrManager) {
    return { data: null, error: 'You do not have permission to upload a product logo.' }
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const folder = PRODUCT_LOGO_CLOUDINARY_FOLDER
  const signature = signCloudinaryParams({ timestamp, folder }, apiSecret)

  return {
    data: {
      signature,
      timestamp,
      cloudName,
      apiKey,
      folder,
    },
    error: null,
  }
}

export async function getProductsPage(options: GetProductsPageOptions = {}): Promise<ProductListResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: [], totalCount: 0, error: ensureLoggedIn() }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.products, 'read')
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager'
  if (!canRead && !isAdminOrManager) {
    return { data: [], totalCount: 0, error: 'You do not have permission to view products' }
  }

  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  const supabase = await createSupabaseClient()

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Cast to any because Supabase RPC TypeScript typings for params are not generated in this project.
  const { data, error, count } = await (supabase as any).rpc('get_products_with_client_counts', {
    p_search: options.search?.trim() || null,
    p_limit: pageSize,
    p_offset: from,
  })

  if (error) {
    console.error('Error fetching products:', error)
    return { data: [], totalCount: 0, error: error.message || 'Failed to fetch products' }
  }

  const list = (data || []).map((row: any) => ({
    id: row.id as string,
    name: row.name as string,
    description: (row.description ?? null) as string | null,
    icon_url: (row.icon_url ?? null) as string | null,
    is_annual_subscription: Boolean(row.is_annual_subscription),
    active_client_count: Number(row.active_client_count ?? 0),
    expired_client_count: Number(row.expired_client_count ?? 0),
  })) as ProductListItem[]

  const totalCount = typeof count === 'number' ? count : list.length
  return { data: list, totalCount, error: null }
}

export async function getProduct(productId: string): Promise<{ data: Product | null; error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: ensureLoggedIn() }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.products, 'read')
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager'
  if (!canRead && !isAdminOrManager) {
    return { data: null, error: 'You do not have permission to view this product' }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, icon_url, is_annual_subscription, created_by, created_at, updated_at')
    .eq('id', productId)
    .single()

  if (error || !data) {
    console.error('Error fetching product:', error)
    return { data: null, error: error?.message || 'Failed to fetch product' }
  }

  return { data: data as Product, error: null }
}

export async function getProductSubscriptions(productId: string): Promise<ProductSubscriptionsResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: ensureLoggedIn() }
  }
  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.products, 'read')
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager'
  if (!canRead && !isAdminOrManager) {
    return { data: null, error: 'You do not have permission to view product subscriptions' }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('product_client_subscriptions')
    .select(
      'id, product_id, client_id, renew_date, clients (id, name, company_name)'
    )
    .eq('product_id', productId)
    .order('renew_date', { ascending: true })

  if (error) {
    console.error('Error fetching product subscriptions:', error)
    return { data: null, error: error.message || 'Failed to fetch product subscriptions' }
  }

  const rows = (data || []) as Array<{
    id: string
    product_id: string
    client_id: string
    renew_date: string
    clients: { id: string; name: string; company_name: string | null } | { id: string; name: string; company_name: string | null }[] | null
  }>

  const list: ProductClientSubscription[] = rows.map((row) => {
    const clientRaw = row.clients
    const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw
    return {
      id: row.id,
      product_id: row.product_id,
      client_id: row.client_id,
      client_name: client?.name ?? 'Unknown',
      client_company_name: client?.company_name ?? null,
      renew_date: row.renew_date,
    }
  })

  return { data: list, error: null }
}

export async function createProduct(formData: ProductFormData): Promise<ProductActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: ensureLoggedIn() }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.products, 'write')
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager'
  if (!canWrite && !isAdminOrManager) {
    return { data: null, error: 'You do not have permission to create products' }
  }

  if (!formData.name?.trim()) {
    return { data: null, error: 'Product name is required' }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      icon_url: formData.icon_url?.trim() || null,
      is_annual_subscription: formData.is_annual_subscription,
      created_by: currentUser.id,
    } as never)
    .select()
    .single()

  if (error || !data) {
    console.error('Error creating product:', error)
    return { data: null, error: error?.message || 'Failed to create product' }
  }

  const product = data as Product

  // Upsert initial subscriptions (one per client)
  const uniqueClientIds = Array.from(
    new Set(formData.subscriptions.map((s) => s.client_id).filter(Boolean))
  )
  if (uniqueClientIds.length > 0) {
    const subscriptionRows = uniqueClientIds.map((clientId) => {
      const match = formData.subscriptions.find((s) => s.client_id === clientId)
      return {
        product_id: product.id,
        client_id: clientId,
        renew_date: match?.renew_date,
        created_by: currentUser.id,
      }
    })

    const { error: subError } = await supabase
      .from('product_client_subscriptions')
      .insert(subscriptionRows as never)

    if (subError) {
      console.error('Error creating product subscriptions:', subError)
      return {
        data: null,
        error: subError.message || 'Product created, but failed to save subscriptions',
      }
    }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Create',
    moduleName: 'Products',
    recordId: product.id,
    description: `Created product "${product.name}"`,
    status: 'Success',
  })

  revalidatePath('/dashboard/products')
  return { data: product, error: null }
}

export async function updateProduct(productId: string, formData: ProductFormData): Promise<ProductActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: ensureLoggedIn() }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.products, 'write')
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager'
  if (!canWrite && !isAdminOrManager) {
    return { data: null, error: 'You do not have permission to update this product' }
  }

  if (!formData.name?.trim()) {
    return { data: null, error: 'Product name is required' }
  }

  const supabase = await createSupabaseClient()

  // Ensure product exists
  const { data: existing, error: fetchError } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .single()

  if (fetchError || !existing) {
    return { data: null, error: 'Product not found' }
  }

  const { data, error } = await supabase
    .from('products')
    .update({
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      icon_url: formData.icon_url?.trim() || null,
      is_annual_subscription: formData.is_annual_subscription,
    } as never)
    .eq('id', productId)
    .select()
    .single()

  if (error || !data) {
    console.error('Error updating product:', error)
    return { data: null, error: error?.message || 'Failed to update product' }
  }

  // Sync subscriptions:
  // - delete removed
  // - upsert (insert or update renew_date) for provided ones
  const uniqueClientIds = Array.from(
    new Set(formData.subscriptions.map((s) => s.client_id).filter(Boolean))
  )

  const { data: existingSubs, error: subsError } = await supabase
    .from('product_client_subscriptions')
    .select('id, client_id')
    .eq('product_id', productId)

  if (subsError) {
    console.error('Error fetching existing product subscriptions:', subsError)
    return {
      data: null,
      error: subsError.message || 'Product updated, but failed to read subscriptions',
    }
  }

  const existingClientIds = new Set(
    ((existingSubs as Array<{ client_id: string }> | null) ?? []).map((row) => row.client_id)
  )
  const targetClientIdSet = new Set(uniqueClientIds)

  const clientIdsToDelete = Array.from(existingClientIds).filter(
    (clientId) => !targetClientIdSet.has(clientId)
  )

  if (clientIdsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('product_client_subscriptions')
      .delete()
      .eq('product_id', productId)
      .in('client_id', clientIdsToDelete)

    if (deleteError) {
      console.error('Error deleting product subscriptions:', deleteError)
      return {
        data: null,
        error: deleteError.message || 'Product updated, but failed to remove old subscriptions',
      }
    }
  }

  // Upsert subscriptions for current list
  if (uniqueClientIds.length > 0) {
    const rows = uniqueClientIds.map((clientId) => {
      const match = formData.subscriptions.find((s) => s.client_id === clientId)
      return {
        product_id: productId,
        client_id: clientId,
        renew_date: match?.renew_date,
        created_by: currentUser.id,
      }
    })

    const { error: upsertError } = await supabase
      .from('product_client_subscriptions')
      .upsert(rows as never, { onConflict: 'product_id,client_id' })

    if (upsertError) {
      console.error('Error upserting product subscriptions:', upsertError)
      return {
        data: null,
        error: upsertError.message || 'Product updated, but failed to save subscriptions',
      }
    }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Update',
    moduleName: 'Products',
    recordId: productId,
    description: `Updated product "${formData.name}"`,
    status: 'Success',
  })

  revalidatePath('/dashboard/products')
  revalidatePath(`/dashboard/products/${productId}`)
  return { data: data as Product, error: null }
}

export async function deleteProduct(productId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: ensureLoggedIn() }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.products, 'write')
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager'
  if (!canWrite && !isAdminOrManager) {
    return { error: 'You do not have permission to delete this product' }
  }

  const supabase = await createSupabaseClient()
  const { data: existing, error: fetchError } = await supabase
    .from('products')
    .select('id, name')
    .eq('id', productId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Product not found' }
  }

  const { error } = await supabase.from('products').delete().eq('id', productId)

  if (error) {
    console.error('Error deleting product:', error)
    return { error: error.message || 'Failed to delete product' }
  }

  await createActivityLogEntry({
    userId: currentUser.id,
    userName: currentUser.fullName ?? currentUser.email,
    actionType: 'Delete',
    moduleName: 'Products',
    recordId: productId,
    description: 'Deleted product',
    status: 'Success',
  })

  revalidatePath('/dashboard/products')
  return { error: null }
}

export async function renewProductSubscription(
  productId: string,
  clientId: string,
  renewDateInput?: string
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: ensureLoggedIn() }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.products, 'write')
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager'
  if (!canWrite && !isAdminOrManager) {
    return { error: 'You do not have permission to renew subscriptions' }
  }

  const supabase = await createSupabaseClient()

  let renewDate = renewDateInput
  if (!renewDate) {
    const today = new Date()
    const nextYear = new Date(today)
    nextYear.setFullYear(today.getFullYear() + 1)
    renewDate = nextYear.toISOString().slice(0, 10)
  }

  const { error } = await supabase
    .from('product_client_subscriptions')
    .upsert(
      {
        product_id: productId,
        client_id: clientId,
        renew_date: renewDate,
        created_by: currentUser.id,
      } as never,
      { onConflict: 'product_id,client_id' }
    )

  if (error) {
    console.error('Error renewing subscription:', error)
    return { error: error.message || 'Failed to renew subscription' }
  }

  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath('/dashboard/products')
  return { error: null }
}

export async function addProductSubscription(
  productId: string,
  clientId: string,
  renewDateInput?: string
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: ensureLoggedIn() }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.products, 'write')
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager'
  if (!canWrite && !isAdminOrManager) {
    return { error: 'You do not have permission to manage subscriptions' }
  }

  const supabase = await createSupabaseClient()

  let renewDate = renewDateInput
  if (!renewDate) {
    const today = new Date()
    const nextYear = new Date(today)
    nextYear.setFullYear(today.getFullYear() + 1)
    renewDate = nextYear.toISOString().slice(0, 10)
  }

  const { error } = await supabase
    .from('product_client_subscriptions')
    .upsert(
      {
        product_id: productId,
        client_id: clientId,
        renew_date: renewDate,
        created_by: currentUser.id,
      } as never,
      { onConflict: 'product_id,client_id' }
    )

  if (error) {
    console.error('Error adding product subscription:', error)
    return { error: error.message || 'Failed to add client to product' }
  }

  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath('/dashboard/products')
  return { error: null }
}

export async function deleteProductSubscription(productId: string, clientId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: ensureLoggedIn() }
  }
  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.products, 'write')
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager'
  if (!canWrite && !isAdminOrManager) {
    return { error: 'You do not have permission to manage subscriptions' }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from('product_client_subscriptions')
    .delete()
    .eq('product_id', productId)
    .eq('client_id', clientId)

  if (error) {
    console.error('Error deleting product subscription:', error)
    return { error: error.message || 'Failed to remove client from product' }
  }

  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath('/dashboard/products')
  return { error: null }
}

