-- Migration 026: Payment Module schema
-- 1. Add is_default to financial_accounts (only one account can be default; enforced in app)
-- 2. Add optional project_id to accounting_entries for project-related payments

-- 1. Financial accounts: default flag
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_financial_accounts_is_default ON public.financial_accounts(is_default) WHERE is_default = true;

-- 2. Accounting entries: optional project link (for client payments from Payment module)
ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_entries_project_id ON public.accounting_entries(project_id) WHERE project_id IS NOT NULL;
