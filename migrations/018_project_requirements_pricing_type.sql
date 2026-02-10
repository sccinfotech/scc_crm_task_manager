-- Migration 018: Add pricing_type to project requirements
-- Depends on: 017_project_requirements

ALTER TABLE public.project_requirements
  ADD COLUMN IF NOT EXISTS pricing_type TEXT NOT NULL DEFAULT 'hourly';

ALTER TABLE public.project_requirements
  DROP CONSTRAINT IF EXISTS project_requirements_pricing_type_check;

ALTER TABLE public.project_requirements
  ADD CONSTRAINT project_requirements_pricing_type_check
  CHECK (pricing_type IN ('hourly', 'fixed', 'milestone'));
