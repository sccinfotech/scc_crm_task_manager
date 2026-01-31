-- Create leads table to store lead information
-- This table tracks potential customers and their status in the sales pipeline

-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  source TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add check constraint for status field
-- This ensures only valid status values can be stored
ALTER TABLE public.leads
ADD CONSTRAINT leads_status_check
CHECK (status IN ('new', 'contacted', 'follow_up', 'converted', 'lost'));

-- Create index on created_by for faster lookups of leads by creator
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by);

-- Create index on status for filtering leads by status
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

-- Create index on email for faster lookups (when email is provided)
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email) WHERE email IS NOT NULL;

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only authenticated users can insert leads
-- Users can only insert leads with themselves as the creator
CREATE POLICY "Authenticated users can insert leads"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- RLS Policy: Users can read leads they created
-- This allows users to view their own leads
CREATE POLICY "Users can read own leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policy: Admin users can read all leads
-- This allows admin users to view all leads regardless of creator
CREATE POLICY "Admins can read all leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policy: Users can update leads they created
-- This allows users to modify their own leads
CREATE POLICY "Users can update own leads"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- RLS Policy: Admin users can update all leads
-- This allows admin users to modify any lead regardless of creator
CREATE POLICY "Admins can update all leads"
  ON public.leads
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

-- Create trigger to automatically update updated_at timestamp
-- This uses the existing update_updated_at_column() function from migration 001
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

