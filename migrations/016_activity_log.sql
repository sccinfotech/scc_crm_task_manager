-- Migration 016: Activity Log Module
-- Centralized system activity tracking: who, what, when, which record, result.
-- Used for accountability, transparency, and auditing.

-- activity_log table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('Create', 'Update', 'Delete', 'Login', 'Logout')),
  module_name TEXT NOT NULL,
  record_id TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Success' CHECK (status IN ('Success', 'Failed')),
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for fast filtering and date-based queries
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON public.activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_module_name ON public.activity_log(module_name);
CREATE INDEX IF NOT EXISTS idx_activity_log_status ON public.activity_log(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_record_id ON public.activity_log(record_id);

-- RLS: only authenticated users can read; inserts come from backend (service or authenticated)
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (filtering by permission is done in app layer)
DROP POLICY IF EXISTS "Authenticated users can read activity_log" ON public.activity_log;
CREATE POLICY "Authenticated users can read activity_log"
  ON public.activity_log
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert (logging is done from server actions with current user)
DROP POLICY IF EXISTS "Authenticated users can insert activity_log" ON public.activity_log;
CREATE POLICY "Authenticated users can insert activity_log"
  ON public.activity_log
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow delete only for authenticated (app layer restricts to high-level users)
DROP POLICY IF EXISTS "Authenticated users can delete activity_log" ON public.activity_log;
CREATE POLICY "Authenticated users can delete activity_log"
  ON public.activity_log
  FOR DELETE
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.activity_log IS 'System activity log for Create/Update/Delete/Login/Logout actions';
