-- Migration 023: Remove quotation_date from quotations (creation date is the quotation date)
-- Depends on: 022_quotation_module.sql

ALTER TABLE public.quotations DROP COLUMN IF EXISTS quotation_date;
