-- Migration 017: Project requirements
-- Depends on: 016_team_talk_policy_updates

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
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
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
