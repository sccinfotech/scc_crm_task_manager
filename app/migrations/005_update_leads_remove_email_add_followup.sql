-- Migration to remove email field and add follow_up_date field to leads table

-- Drop the email index if it exists
DROP INDEX IF EXISTS idx_leads_email;

-- Remove email column
ALTER TABLE public.leads DROP COLUMN IF EXISTS email;

-- Add follow_up_date column (optional, can be NULL)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE;

-- Create index on follow_up_date for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON public.leads(follow_up_date) WHERE follow_up_date IS NOT NULL;

