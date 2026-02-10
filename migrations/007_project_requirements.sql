-- Migration 007: Project requirements and milestones
-- Consolidates: 017_project_requirements, 018_project_requirements_pricing_type, 019_project_requirement_milestones.
-- Depends on: 005_project_management.

-- 1. Project requirements (with pricing_type)
CREATE TABLE IF NOT EXISTS public.project_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
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
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT project_requirements_pricing_type_check CHECK (pricing_type IN ('hourly', 'fixed', 'milestone'))
);

CREATE INDEX IF NOT EXISTS idx_project_requirements_project_id ON public.project_requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_project_requirements_created_by ON public.project_requirements(created_by);
CREATE INDEX IF NOT EXISTS idx_project_requirements_created_at ON public.project_requirements(created_at);
CREATE INDEX IF NOT EXISTS idx_project_requirements_type ON public.project_requirements(requirement_type);

DROP TRIGGER IF EXISTS update_project_requirements_updated_at ON public.project_requirements;
CREATE TRIGGER update_project_requirements_updated_at
  BEFORE UPDATE ON public.project_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.project_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read project requirements" ON public.project_requirements;
DROP POLICY IF EXISTS "Users can insert project requirements" ON public.project_requirements;
DROP POLICY IF EXISTS "Users can update project requirements" ON public.project_requirements;
DROP POLICY IF EXISTS "Users can delete project requirements" ON public.project_requirements;

CREATE POLICY "Users can read project requirements"
  ON public.project_requirements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = project_requirements.project_id
        AND ptm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert project requirements"
  ON public.project_requirements
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
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users can update project requirements"
  ON public.project_requirements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
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
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users can delete project requirements"
  ON public.project_requirements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
        )
    )
  );

-- 2. Project requirement milestones
CREATE TABLE IF NOT EXISTS public.project_requirement_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES public.project_requirements(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  amount TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_requirement_milestones_requirement_id ON public.project_requirement_milestones(requirement_id);
CREATE INDEX IF NOT EXISTS idx_project_requirement_milestones_project_id ON public.project_requirement_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_requirement_milestones_created_at ON public.project_requirement_milestones(created_at);

DROP TRIGGER IF EXISTS update_project_requirement_milestones_updated_at ON public.project_requirement_milestones;
CREATE TRIGGER update_project_requirement_milestones_updated_at
  BEFORE UPDATE ON public.project_requirement_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.project_requirement_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read requirement milestones" ON public.project_requirement_milestones;
DROP POLICY IF EXISTS "Users can insert requirement milestones" ON public.project_requirement_milestones;
DROP POLICY IF EXISTS "Users can update requirement milestones" ON public.project_requirement_milestones;
DROP POLICY IF EXISTS "Users can delete requirement milestones" ON public.project_requirement_milestones;

CREATE POLICY "Users can read requirement milestones"
  ON public.project_requirement_milestones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = project_requirement_milestones.project_id
        AND ptm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert requirement milestones"
  ON public.project_requirement_milestones
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
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users can update requirement milestones"
  ON public.project_requirement_milestones
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
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
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users can delete requirement milestones"
  ON public.project_requirement_milestones
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
        )
    )
  );
