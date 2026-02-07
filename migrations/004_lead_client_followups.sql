-- Migration 004: Unified Lead/Client Follow-ups
-- Single follow-up table for both leads and clients (entity_type), optional note and follow_up_date.
-- Depends on: 001_auth_user_management, 002_lead_management, 003_client_management.

-- 1. Unified Follow-ups Table
CREATE TABLE IF NOT EXISTS public.lead_client_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'client')),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  note TEXT,
  follow_up_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT lead_client_followups_one_parent CHECK (
    (lead_id IS NOT NULL AND client_id IS NULL)
    OR (lead_id IS NULL AND client_id IS NOT NULL)
  )
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_lead_client_followups_lead_id ON public.lead_client_followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_client_followups_client_id ON public.lead_client_followups(client_id);
CREATE INDEX IF NOT EXISTS idx_lead_client_followups_entity_type ON public.lead_client_followups(entity_type);
CREATE INDEX IF NOT EXISTS idx_lead_client_followups_created_by ON public.lead_client_followups(created_by);
CREATE INDEX IF NOT EXISTS idx_lead_client_followups_follow_up_date ON public.lead_client_followups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_lead_client_followups_client_entity_date ON public.lead_client_followups(client_id, entity_type, created_at);

-- 3. updated_at Trigger
DROP TRIGGER IF EXISTS update_lead_client_followups_updated_at ON public.lead_client_followups;
CREATE TRIGGER update_lead_client_followups_updated_at
  BEFORE UPDATE ON public.lead_client_followups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Row Level Security (module: leads for lead follow-ups, customers for client follow-ups)
ALTER TABLE public.lead_client_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read lead-client follow-ups" ON public.lead_client_followups;
DROP POLICY IF EXISTS "Users can insert lead-client follow-ups" ON public.lead_client_followups;
DROP POLICY IF EXISTS "Users can update lead-client follow-ups" ON public.lead_client_followups;
DROP POLICY IF EXISTS "Users can delete lead-client follow-ups" ON public.lead_client_followups;

CREATE POLICY "Users can read lead-client follow-ups"
  ON public.lead_client_followups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR (
            entity_type = 'lead'
            AND COALESCE(u.module_permissions->>'leads', 'none') IN ('read', 'write')
          )
          OR (
            entity_type = 'client'
            AND COALESCE(u.module_permissions->>'customers', 'none') IN ('read', 'write')
          )
        )
    )
  );

CREATE POLICY "Users can insert lead-client follow-ups"
  ON public.lead_client_followups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR (
            entity_type = 'lead'
            AND COALESCE(u.module_permissions->>'leads', 'none') = 'write'
          )
          OR (
            entity_type = 'client'
            AND COALESCE(u.module_permissions->>'customers', 'none') = 'write'
          )
        )
    )
  );

CREATE POLICY "Users can update lead-client follow-ups"
  ON public.lead_client_followups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR (
            entity_type = 'lead'
            AND COALESCE(u.module_permissions->>'leads', 'none') = 'write'
          )
          OR (
            entity_type = 'client'
            AND COALESCE(u.module_permissions->>'customers', 'none') = 'write'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR (
            entity_type = 'lead'
            AND COALESCE(u.module_permissions->>'leads', 'none') = 'write'
          )
          OR (
            entity_type = 'client'
            AND COALESCE(u.module_permissions->>'customers', 'none') = 'write'
          )
        )
    )
  );

CREATE POLICY "Users can delete lead-client follow-ups"
  ON public.lead_client_followups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR (
            entity_type = 'lead'
            AND COALESCE(u.module_permissions->>'leads', 'none') = 'write'
          )
          OR (
            entity_type = 'client'
            AND COALESCE(u.module_permissions->>'customers', 'none') = 'write'
          )
        )
    )
  );
