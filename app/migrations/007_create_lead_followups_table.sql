-- Create lead_followups table to store follow-up records for leads
-- This table tracks scheduled follow-up activities, notes, and dates for each lead
-- Each follow-up is linked to a specific lead and can be created by any authenticated user

-- Create lead_followups table
CREATE TABLE IF NOT EXISTS public.lead_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  follow_up_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on lead_id for faster lookups of follow-ups by lead
-- This is critical for querying all follow-ups for a specific lead
CREATE INDEX IF NOT EXISTS idx_lead_followups_lead_id ON public.lead_followups(lead_id);

-- Create index on created_by for faster lookups of follow-ups by creator
-- This helps with filtering follow-ups by the user who created them
CREATE INDEX IF NOT EXISTS idx_lead_followups_created_by ON public.lead_followups(created_by);

-- Create index on follow_up_date for faster date-based queries
-- This enables efficient filtering and sorting by follow-up date
CREATE INDEX IF NOT EXISTS idx_lead_followups_follow_up_date ON public.lead_followups(follow_up_date);

-- Create composite index on lead_id and follow_up_date for common query patterns
-- This optimizes queries that filter by both lead and date range
CREATE INDEX IF NOT EXISTS idx_lead_followups_lead_date ON public.lead_followups(lead_id, follow_up_date);

-- Enable Row Level Security
-- RLS ensures users can only access follow-ups they created (unless they are admins)
ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only authenticated users can insert follow-ups
-- Users can only insert follow-ups with themselves as the creator
-- This prevents users from creating follow-ups on behalf of other users
CREATE POLICY "Authenticated users can insert follow-ups"
  ON public.lead_followups
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- RLS Policy: Users can read follow-ups they created
-- This allows users to view their own follow-up records
CREATE POLICY "Users can read own follow-ups"
  ON public.lead_followups
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policy: Admin users can read all follow-ups
-- This allows admin users to view all follow-ups regardless of creator
-- Admins need this access to monitor team activities and provide support
CREATE POLICY "Admins can read all follow-ups"
  ON public.lead_followups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policy: Users can update follow-ups they created
-- This allows users to modify their own follow-up records (e.g., update notes or dates)
-- Both USING and WITH CHECK ensure users can only update their own records
CREATE POLICY "Users can update own follow-ups"
  ON public.lead_followups
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- RLS Policy: Admin users can update all follow-ups
-- This allows admin users to modify any follow-up regardless of creator
-- Useful for corrections, reassignments, or administrative updates
CREATE POLICY "Admins can update all follow-ups"
  ON public.lead_followups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policy: Users can delete follow-ups they created
-- This allows users to remove their own follow-up records
CREATE POLICY "Users can delete own follow-ups"
  ON public.lead_followups
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policy: Admin users can delete all follow-ups
-- This allows admin users to remove any follow-up regardless of creator
-- Useful for data cleanup and administrative corrections
CREATE POLICY "Admins can delete all follow-ups"
  ON public.lead_followups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create trigger to automatically update updated_at timestamp
-- This uses the existing update_updated_at_column() function from migration 001
-- Ensures updated_at is always current when a follow-up record is modified
-- Drop trigger if it already exists to allow re-running the migration
DROP TRIGGER IF EXISTS update_lead_followups_updated_at ON public.lead_followups;

CREATE TRIGGER update_lead_followups_updated_at
  BEFORE UPDATE ON public.lead_followups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

