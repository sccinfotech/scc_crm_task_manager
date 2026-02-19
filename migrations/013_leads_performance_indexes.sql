-- Migration 013: Leads Performance Indexes
-- Adds indexes to improve query performance for leads page
-- Depends on: 002_lead_management

-- Enable pg_trgm extension for trigram-based text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Performance: Trigram indexes for ILIKE search queries on name and company_name
-- These significantly speed up pattern matching queries
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON public.leads USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_company_name_trgm ON public.leads USING gin(company_name gin_trgm_ops) WHERE company_name IS NOT NULL;

-- Performance: Composite indexes for common filter combinations
-- Speeds up queries that filter by status and sort by created_at or follow_up_date
CREATE INDEX IF NOT EXISTS idx_leads_status_created_at ON public.leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status_follow_up_date ON public.leads(status, follow_up_date) WHERE follow_up_date IS NOT NULL;

-- Performance: Index for sorting by created_at (if not already covered)
CREATE INDEX IF NOT EXISTS idx_leads_created_at_desc ON public.leads(created_at DESC);
