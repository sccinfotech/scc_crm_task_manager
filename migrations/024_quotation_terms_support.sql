-- Migration 024: Add terms and support notes to quotations

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS terms TEXT,
  ADD COLUMN IF NOT EXISTS support TEXT;
