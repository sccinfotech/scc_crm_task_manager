-- Migration 025: Add title and notes to quotations
-- Depends on: 024_quotation_terms_support.sql

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

