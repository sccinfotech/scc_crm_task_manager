-- Migration 033: HSN / SAC per invoice line item (was on invoice header in 032)
-- Depends on: 032_invoice_hsn_codes

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS hsn_code_id UUID NULL REFERENCES public.hsn_codes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_items_hsn_code_id ON public.invoice_items(hsn_code_id) WHERE hsn_code_id IS NOT NULL;

-- Copy header HSN onto every line of that invoice, then drop header column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'hsn_code_id'
  ) THEN
    UPDATE public.invoice_items ii
    SET hsn_code_id = i.hsn_code_id
    FROM public.invoices i
    WHERE ii.invoice_id = i.id
      AND i.hsn_code_id IS NOT NULL
      AND ii.hsn_code_id IS NULL;

    ALTER TABLE public.invoices DROP COLUMN hsn_code_id;
  END IF;
END $$;
