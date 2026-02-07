-- Migration 009: Store project_amount as encrypted TEXT
-- Application encrypts on write and decrypts on read. Column holds base64 ciphertext or legacy plain numeric string.
-- Depends on: 008_remove_expected_end_date

-- 1. Drop the numeric check constraint (cannot enforce >= 0 on encrypted data)
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_amount_check;

-- 2. Change column type from NUMERIC to TEXT
-- Existing values become text representation of numbers (legacy); app decrypts or parses as number on read
ALTER TABLE public.projects
  ALTER COLUMN project_amount TYPE TEXT USING (project_amount::TEXT);
