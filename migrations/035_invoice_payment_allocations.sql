-- Migration 035: Invoice payment allocations (auto-pay invoices from Payment module)
--
-- Adds:
-- 1) invoices.paid_amount: running sum of allocations
-- 2) invoice_payment_allocations: link between accounting_entries (income) and invoices
--
-- Notes:
-- - Payment module creates accounting_entries with project_id.
-- - We allocate those amounts across invoices that contain invoice_items for that project.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_invoices_paid_amount ON public.invoices(paid_amount);

CREATE TABLE IF NOT EXISTS public.invoice_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  accounting_entry_id UUID NOT NULL REFERENCES public.accounting_entries(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_allocations_invoice_id
  ON public.invoice_payment_allocations(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_allocations_accounting_entry_id
  ON public.invoice_payment_allocations(accounting_entry_id);

ALTER TABLE public.invoice_payment_allocations ENABLE ROW LEVEL SECURITY;

-- Mirror invoice read/write access patterns (same module permission gate).
DROP POLICY IF EXISTS "Users with invoices read access can read invoice payment allocations" ON public.invoice_payment_allocations;
DROP POLICY IF EXISTS "Users with invoices write access can insert invoice payment allocations" ON public.invoice_payment_allocations;
DROP POLICY IF EXISTS "Users with invoices write access can delete invoice payment allocations" ON public.invoice_payment_allocations;

CREATE POLICY "Users with invoices read access can read invoice payment allocations"
  ON public.invoice_payment_allocations
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

CREATE POLICY "Users with invoices write access can insert invoice payment allocations"
  ON public.invoice_payment_allocations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'invoices', 'none') = 'write')
    )
  );

CREATE POLICY "Users with invoices write access can delete invoice payment allocations"
  ON public.invoice_payment_allocations
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

