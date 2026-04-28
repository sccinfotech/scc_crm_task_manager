-- Migration 031: Invoices Module
-- Tables: invoices, invoice_items
-- Depends on: 001_auth_user_management, 003_client_management, 005_project_management

-- 1. Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_type TEXT NOT NULL DEFAULT 'gst' CHECK (invoice_type IN ('gst', 'non_gst')),
  -- Derived from client GST number + billing_state_code at creation time (UI shows it)
  gst_tax_type TEXT NOT NULL DEFAULT 'none' CHECK (gst_tax_type IN ('cgst_sgst', 'igst', 'none')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  cgst_rate NUMERIC NOT NULL DEFAULT 0,
  cgst_amount NUMERIC NOT NULL DEFAULT 0,
  sgst_rate NUMERIC NOT NULL DEFAULT 0,
  sgst_amount NUMERIC NOT NULL DEFAULT 0,
  igst_rate NUMERIC NOT NULL DEFAULT 0,
  igst_amount NUMERIC NOT NULL DEFAULT 0,
  total_tax NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  terms_and_conditions TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partial_paid')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number_unique ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON public.invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at);

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with invoices read access can read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users with invoices write access can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users with invoices write access can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users with invoices write access can delete invoices" ON public.invoices;

CREATE POLICY "Users with invoices read access can read invoices"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'invoices', 'none') IN ('read', 'write'))
    )
  );

CREATE POLICY "Users with invoices write access can insert invoices"
  ON public.invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'invoices', 'none') = 'write')
    )
  );

CREATE POLICY "Users with invoices write access can update invoices"
  ON public.invoices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'invoices', 'none') = 'write')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'invoices', 'none') = 'write')
    )
  );

CREATE POLICY "Users with invoices write access can delete invoices"
  ON public.invoices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'invoices', 'none') = 'write')
    )
  );

-- 2. Invoice items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  narration TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_project_id ON public.invoice_items(project_id) WHERE project_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_invoice_items_updated_at ON public.invoice_items;
CREATE TRIGGER update_invoice_items_updated_at
  BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete invoice items" ON public.invoice_items;

CREATE POLICY "Users can read invoice items"
  ON public.invoice_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'invoices', 'none') IN ('read', 'write'))
    )
  );

CREATE POLICY "Users can insert invoice items"
  ON public.invoice_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'invoices', 'none') = 'write')
    )
  );

CREATE POLICY "Users can update invoice items"
  ON public.invoice_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'invoices', 'none') = 'write')
    )
  );

CREATE POLICY "Users can delete invoice items"
  ON public.invoice_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'invoices', 'none') = 'write')
    )
  );

