-- Migration 002: Lead Management
-- Consolidates leads table and module-permission–aware RLS.
-- Depends on: 001_auth_user_management (users, update_updated_at_column).

-- 1. Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT NOT NULL,
  source TEXT,
  status TEXT NOT NULL,
  follow_up_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Leads Constraint
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads
ADD CONSTRAINT leads_status_check
CHECK (status IN ('new', 'contacted', 'follow_up', 'converted', 'lost'));

-- 3. Leads Indexes
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON public.leads(follow_up_date) WHERE follow_up_date IS NOT NULL;

-- 4. Leads Row Level Security (module_permissions: leads read/write)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Users can read own leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can read all leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can update all leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete all leads" ON public.leads;
DROP POLICY IF EXISTS "Users with lead read access can read leads" ON public.leads;
DROP POLICY IF EXISTS "Users with lead write access can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Users with lead write access can update leads" ON public.leads;
DROP POLICY IF EXISTS "Users with lead write access can delete leads" ON public.leads;

CREATE POLICY "Users with lead read access can read leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'leads', 'none') IN ('read', 'write')
        )
    )
  );

CREATE POLICY "Users with lead write access can insert leads"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'leads', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with lead write access can update leads"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'leads', 'none') = 'write'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'leads', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with lead write access can delete leads"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'leads', 'none') = 'write'
        )
    )
  );

-- 5. Leads updated_at Trigger
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
