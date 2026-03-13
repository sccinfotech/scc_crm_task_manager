-- Migration 026: Products Module
-- Adds products and product_client_subscriptions tables with RLS and triggers.
-- Depends on: 001_auth_user_management, 003_client_management.

-- 1. Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  is_annual_subscription BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_created_by ON public.products(created_by);
CREATE INDEX IF NOT EXISTS idx_products_is_annual_subscription ON public.products(is_annual_subscription);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at);

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Product <-> Client subscriptions table
CREATE TABLE IF NOT EXISTS public.product_client_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  renew_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT product_client_subscriptions_unique UNIQUE (product_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_product_client_subscriptions_product_id ON public.product_client_subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_client_subscriptions_client_id ON public.product_client_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_product_client_subscriptions_renew_date ON public.product_client_subscriptions(renew_date);

DROP TRIGGER IF EXISTS update_product_client_subscriptions_updated_at ON public.product_client_subscriptions;
CREATE TRIGGER update_product_client_subscriptions_updated_at
  BEFORE UPDATE ON public.product_client_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. RLS for products (module_permissions: products)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with products read access can read products" ON public.products;
DROP POLICY IF EXISTS "Users with products write access can insert products" ON public.products;
DROP POLICY IF EXISTS "Users with products write access can update products" ON public.products;
DROP POLICY IF EXISTS "Users with products write access can delete products" ON public.products;

CREATE POLICY "Users with products read access can read products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'products', 'none') IN ('read', 'write')
        )
    )
  );

CREATE POLICY "Users with products write access can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'products', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with products write access can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'products', 'none') = 'write'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'products', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with products write access can delete products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'products', 'none') = 'write'
        )
    )
  );

-- 4. RLS for product_client_subscriptions (same module: products)
ALTER TABLE public.product_client_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with products read access can read product client subscriptions" ON public.product_client_subscriptions;
DROP POLICY IF EXISTS "Users with products write access can insert product client subscriptions" ON public.product_client_subscriptions;
DROP POLICY IF EXISTS "Users with products write access can update product client subscriptions" ON public.product_client_subscriptions;
DROP POLICY IF EXISTS "Users with products write access can delete product client subscriptions" ON public.product_client_subscriptions;

CREATE POLICY "Users with products read access can read product client subscriptions"
  ON public.product_client_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'products', 'none') IN ('read', 'write')
        )
    )
  );

CREATE POLICY "Users with products write access can insert product client subscriptions"
  ON public.product_client_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'products', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with products write access can update product client subscriptions"
  ON public.product_client_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'products', 'none') = 'write'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'products', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with products write access can delete product client subscriptions"
  ON public.product_client_subscriptions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'products', 'none') = 'write'
        )
    )
  );

-- 5. Helper function for list view: products with active/expired client counts
-- Uses CURRENT_DATE to derive Active (renew_date >= today) vs Expired (renew_date < today).
CREATE OR REPLACE FUNCTION public.get_products_with_client_counts(
  p_search TEXT,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  icon_url TEXT,
  is_annual_subscription BOOLEAN,
  active_client_count BIGINT,
  expired_client_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.icon_url,
    p.is_annual_subscription,
    COALESCE(SUM(CASE WHEN pcs.renew_date >= CURRENT_DATE THEN 1 ELSE 0 END), 0) AS active_client_count,
    COALESCE(SUM(CASE WHEN pcs.renew_date < CURRENT_DATE THEN 1 ELSE 0 END), 0) AS expired_client_count
  FROM public.products p
  LEFT JOIN public.product_client_subscriptions pcs
    ON pcs.product_id = p.id
  WHERE
    (
      p_search IS NULL
      OR p_search = ''
      OR p.name ILIKE '%' || p_search || '%'
      OR p.description ILIKE '%' || p_search || '%'
    )
  GROUP BY p.id, p.name, p.description, p.icon_url, p.is_annual_subscription
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

