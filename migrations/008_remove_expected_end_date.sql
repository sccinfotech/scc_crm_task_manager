-- Migration 008: Remove expected_end_date from projects
-- Depends on: 007_project_priority_team_members_and_access

-- 1. Drop the check constraint that references expected_end_date
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_expected_end_date_check;

-- 2. Drop the index on expected_end_date
DROP INDEX IF EXISTS public.idx_projects_expected_end_date;

-- 3. Drop the column
ALTER TABLE public.projects DROP COLUMN IF EXISTS expected_end_date;
