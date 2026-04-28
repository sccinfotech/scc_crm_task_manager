-- Migration 032: HSN reference table + invoice link (header column superseded by 033 per line item)
-- Depends on: 031_invoices_module
-- After 032, run 033_invoice_items_hsn_code.sql to store HSN on each invoice line and drop invoices.hsn_code_id.

CREATE TABLE IF NOT EXISTS public.hsn_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hsn_codes_code_unique ON public.hsn_codes(code);

INSERT INTO public.hsn_codes (code, title, description, sort_order)
SELECT v.code, v.title, v.description, v.sort_order
FROM (VALUES
  ('998314', 'IT Design and Development Services', 'Covers custom software development, systems analysis, and programming services.', 10),
  ('998313', 'IT Consulting and Support Services', 'Used for IT troubleshooting, installation, and support.', 20),
  ('998315', 'Hosting and IT Infrastructure Provisioning', 'Covers cloud hosting, data center services, and managed infrastructure.', 30),
  ('998316', 'IT Network Management Services', 'Used for managing IT systems and networks.', 40),
  ('997331', 'Software Licensing', 'Licensing services for the right to use computer software.', 50)
) AS v(code, title, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.hsn_codes h WHERE h.code = v.code);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS hsn_code_id UUID NULL REFERENCES public.hsn_codes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_hsn_code_id ON public.invoices(hsn_code_id) WHERE hsn_code_id IS NOT NULL;

ALTER TABLE public.hsn_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with invoices read can read hsn_codes" ON public.hsn_codes;

CREATE POLICY "Users with invoices read can read hsn_codes"
  ON public.hsn_codes
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
