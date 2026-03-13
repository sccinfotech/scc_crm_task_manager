-- Migration 025: Accounting Module
-- Tables: financial_accounts, accounting_categories, accounting_entries
-- Depends on: 001_auth_user_management

-- 1. Financial Accounts
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_accounts_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_accounts_name_unique ON public.financial_accounts (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_financial_accounts_status ON public.financial_accounts(status);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_created_by ON public.financial_accounts(created_by);

DROP TRIGGER IF EXISTS update_financial_accounts_updated_at ON public.financial_accounts;
CREATE TRIGGER update_financial_accounts_updated_at
  BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with accounting read access can read financial accounts" ON public.financial_accounts;
DROP POLICY IF EXISTS "Users with accounting write access can insert financial accounts" ON public.financial_accounts;
DROP POLICY IF EXISTS "Users with accounting write access can update financial accounts" ON public.financial_accounts;
DROP POLICY IF EXISTS "Users with accounting write access can delete financial accounts" ON public.financial_accounts;

CREATE POLICY "Users with accounting read access can read financial accounts"
  ON public.financial_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') IN ('read', 'write')
        )
    )
  );

CREATE POLICY "Users with accounting write access can insert financial accounts"
  ON public.financial_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with accounting write access can update financial accounts"
  ON public.financial_accounts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with accounting write access can delete financial accounts"
  ON public.financial_accounts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  );

-- 2. Accounting Categories
CREATE TABLE IF NOT EXISTS public.accounting_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT accounting_categories_type_check CHECK (type IN ('income', 'expense')),
  CONSTRAINT accounting_categories_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_categories_name_type_unique
  ON public.accounting_categories (LOWER(name), type);
CREATE INDEX IF NOT EXISTS idx_accounting_categories_type ON public.accounting_categories(type);
CREATE INDEX IF NOT EXISTS idx_accounting_categories_status ON public.accounting_categories(status);
CREATE INDEX IF NOT EXISTS idx_accounting_categories_created_by ON public.accounting_categories(created_by);

DROP TRIGGER IF EXISTS update_accounting_categories_updated_at ON public.accounting_categories;
CREATE TRIGGER update_accounting_categories_updated_at
  BEFORE UPDATE ON public.accounting_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with accounting read access can read accounting categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Users with accounting write access can insert accounting categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Users with accounting write access can update accounting categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Users with accounting write access can delete accounting categories" ON public.accounting_categories;

CREATE POLICY "Users with accounting read access can read accounting categories"
  ON public.accounting_categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') IN ('read', 'write')
        )
    )
  );

CREATE POLICY "Users with accounting write access can insert accounting categories"
  ON public.accounting_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with accounting write access can update accounting categories"
  ON public.accounting_categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with accounting write access can delete accounting categories"
  ON public.accounting_categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  );

-- 3. Accounting Entries
CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.accounting_categories(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  entry_date DATE NOT NULL,
  remarks TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT accounting_entries_type_check CHECK (entry_type IN ('income', 'expense')),
  CONSTRAINT accounting_entries_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_accounting_entries_account_id ON public.accounting_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_category_id ON public.accounting_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_entry_date ON public.accounting_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_entry_type ON public.accounting_entries(entry_type);

DROP TRIGGER IF EXISTS update_accounting_entries_updated_at ON public.accounting_entries;
CREATE TRIGGER update_accounting_entries_updated_at
  BEFORE UPDATE ON public.accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with accounting read access can read accounting entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users with accounting write access can insert accounting entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users with accounting write access can update accounting entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users with accounting write access can delete accounting entries" ON public.accounting_entries;

CREATE POLICY "Users with accounting read access can read accounting entries"
  ON public.accounting_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') IN ('read', 'write')
        )
    )
  );

CREATE POLICY "Users with accounting write access can insert accounting entries"
  ON public.accounting_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with accounting write access can update accounting entries"
  ON public.accounting_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with accounting write access can delete accounting entries"
  ON public.accounting_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'accounting', 'none') = 'write'
        )
    )
  );

