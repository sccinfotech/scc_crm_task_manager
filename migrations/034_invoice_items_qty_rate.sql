-- Migration 034: Quantity and rate per invoice line; amount remains line total (qty * rate).

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS rate NUMERIC;

-- Legacy rows: treat existing amount as rate with quantity 1
UPDATE public.invoice_items
SET
  quantity = 1,
  rate = COALESCE(amount, 0)
WHERE quantity IS NULL;

ALTER TABLE public.invoice_items
  ALTER COLUMN quantity SET DEFAULT 1,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN rate SET DEFAULT 0,
  ALTER COLUMN rate SET NOT NULL;
