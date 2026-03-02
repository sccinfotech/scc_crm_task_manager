-- Migration 022: Quotation Module
-- quotations, quotation_requirements, quotation_technology_tools; extend project_requirements for quotation linkage.
-- Depends on: 001_auth_user_management, 002_lead_management, 003_client_management, 005_project_management, 007_project_requirements.

-- 1. Quotations table
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('lead', 'client')),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  quotation_date DATE NOT NULL,
  valid_till DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  final_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  reference TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Client snapshot when source=lead (used to create client on conversion)
  client_snapshot_name TEXT,
  client_snapshot_company_name TEXT,
  client_snapshot_phone TEXT,
  client_snapshot_email TEXT,
  client_snapshot_remark TEXT,
  CONSTRAINT quotations_status_check CHECK (
    status IN ('draft', 'sent', 'under_discussion', 'approved', 'rejected', 'expired', 'converted')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_quotation_number ON public.quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_source_type ON public.quotations(source_type);
CREATE INDEX IF NOT EXISTS idx_quotations_lead_id ON public.quotations(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_client_id ON public.quotations(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON public.quotations(created_at);
CREATE INDEX IF NOT EXISTS idx_quotations_valid_till ON public.quotations(valid_till);

DROP TRIGGER IF EXISTS update_quotations_updated_at ON public.quotations;
CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with quotations read access can read quotations" ON public.quotations;
DROP POLICY IF EXISTS "Users with quotations write access can insert quotations" ON public.quotations;
DROP POLICY IF EXISTS "Users with quotations write access can update quotations" ON public.quotations;
DROP POLICY IF EXISTS "Users with quotations write access can delete quotations" ON public.quotations;

CREATE POLICY "Users with quotations read access can read quotations"
  ON public.quotations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') IN ('read', 'write'))
    )
  );

CREATE POLICY "Users with quotations write access can insert quotations"
  ON public.quotations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')
    )
  );

CREATE POLICY "Users with quotations write access can update quotations"
  ON public.quotations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')
    )
  );

CREATE POLICY "Users with quotations write access can delete quotations"
  ON public.quotations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')
    )
  );

-- 2. Quotation <-> Technology Tools junction (multi-select from master)
CREATE TABLE IF NOT EXISTS public.quotation_technology_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  technology_tool_id UUID NOT NULL REFERENCES public.technology_tools(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT quotation_technology_tools_unique UNIQUE (quotation_id, technology_tool_id)
);

CREATE INDEX IF NOT EXISTS idx_quotation_technology_tools_quotation_id ON public.quotation_technology_tools(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_technology_tools_tool_id ON public.quotation_technology_tools(technology_tool_id);

ALTER TABLE public.quotation_technology_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read quotation technology tools" ON public.quotation_technology_tools;
DROP POLICY IF EXISTS "Users can insert quotation technology tools" ON public.quotation_technology_tools;
DROP POLICY IF EXISTS "Users can update quotation technology tools" ON public.quotation_technology_tools;
DROP POLICY IF EXISTS "Users can delete quotation technology tools" ON public.quotation_technology_tools;

CREATE POLICY "Users can read quotation technology tools"
  ON public.quotation_technology_tools
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') IN ('read', 'write'))
    )
  );

CREATE POLICY "Users can insert quotation technology tools"
  ON public.quotation_technology_tools
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')
    )
  );

CREATE POLICY "Users can update quotation technology tools"
  ON public.quotation_technology_tools
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')
    )
  );

CREATE POLICY "Users can delete quotation technology tools"
  ON public.quotation_technology_tools
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')
    )
  );

-- 3. Quotation requirements (same structure as project_requirements, minus project_id → quotation_id)
CREATE TABLE IF NOT EXISTS public.quotation_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('initial', 'addon')),
  title TEXT,
  description TEXT,
  attachment_url TEXT,
  estimated_hours NUMERIC,
  hourly_rate TEXT,
  amount TEXT,
  pricing_type TEXT NOT NULL DEFAULT 'hourly',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT quotation_requirements_pricing_type_check CHECK (pricing_type IN ('hourly', 'fixed', 'milestone'))
);

CREATE INDEX IF NOT EXISTS idx_quotation_requirements_quotation_id ON public.quotation_requirements(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_requirements_created_by ON public.quotation_requirements(created_by);
CREATE INDEX IF NOT EXISTS idx_quotation_requirements_created_at ON public.quotation_requirements(created_at);
CREATE INDEX IF NOT EXISTS idx_quotation_requirements_type ON public.quotation_requirements(requirement_type);

DROP TRIGGER IF EXISTS update_quotation_requirements_updated_at ON public.quotation_requirements;
CREATE TRIGGER update_quotation_requirements_updated_at
  BEFORE UPDATE ON public.quotation_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.quotation_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read quotation requirements" ON public.quotation_requirements;
DROP POLICY IF EXISTS "Users can insert quotation requirements" ON public.quotation_requirements;
DROP POLICY IF EXISTS "Users can update quotation requirements" ON public.quotation_requirements;
DROP POLICY IF EXISTS "Users can delete quotation requirements" ON public.quotation_requirements;

CREATE POLICY "Users can read quotation requirements"
  ON public.quotation_requirements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') IN ('read', 'write'))
    )
  );

CREATE POLICY "Users can insert quotation requirements"
  ON public.quotation_requirements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')
    )
  );

CREATE POLICY "Users can update quotation requirements"
  ON public.quotation_requirements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')
    )
  );

CREATE POLICY "Users can delete quotation requirements"
  ON public.quotation_requirements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')
    )
  );

-- 3b. Quotation requirement milestones (same structure as project_requirement_milestones)
CREATE TABLE IF NOT EXISTS public.quotation_requirement_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES public.quotation_requirements(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  amount TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_requirement_milestones_requirement_id ON public.quotation_requirement_milestones(requirement_id);
CREATE INDEX IF NOT EXISTS idx_quotation_requirement_milestones_quotation_id ON public.quotation_requirement_milestones(quotation_id);

DROP TRIGGER IF EXISTS update_quotation_requirement_milestones_updated_at ON public.quotation_requirement_milestones;
CREATE TRIGGER update_quotation_requirement_milestones_updated_at
  BEFORE UPDATE ON public.quotation_requirement_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.quotation_requirement_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read quotation requirement milestones"
  ON public.quotation_requirement_milestones FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') IN ('read', 'write')))
  );
CREATE POLICY "Users can insert quotation requirement milestones"
  ON public.quotation_requirement_milestones FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')));
CREATE POLICY "Users can update quotation requirement milestones"
  ON public.quotation_requirement_milestones FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')));
CREATE POLICY "Users can delete quotation requirement milestones"
  ON public.quotation_requirement_milestones FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.role IN ('admin', 'manager') OR COALESCE(u.module_permissions->>'quotations', 'none') = 'write')));

-- 4. Extend project_requirements for quotation linkage
ALTER TABLE public.project_requirements
  ADD COLUMN IF NOT EXISTS is_from_quotation BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.project_requirements
  ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_requirements_quotation_id ON public.project_requirements(quotation_id) WHERE quotation_id IS NOT NULL;
