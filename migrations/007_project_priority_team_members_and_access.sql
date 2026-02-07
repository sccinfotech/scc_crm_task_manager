-- Migration 007: Project priority, team members, reference links, optional amount, access updates
-- Depends on: 006_project_updates_and_technology_tools

-- 1. Make project_amount optional
ALTER TABLE public.projects ALTER COLUMN project_amount DROP NOT NULL;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_amount_check;
ALTER TABLE public.projects
ADD CONSTRAINT projects_amount_check
CHECK (project_amount IS NULL OR project_amount >= 0);

-- 2. Add priority and reference links
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS reference_links TEXT;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_priority_check;
ALTER TABLE public.projects
ADD CONSTRAINT projects_priority_check
CHECK (priority IN ('urgent', 'high', 'medium', 'low'));

-- 3. Ensure status default is pending
ALTER TABLE public.projects ALTER COLUMN status SET DEFAULT 'pending';

-- 4. Project team members table
CREATE TABLE IF NOT EXISTS public.project_team_members (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_team_members_project_id ON public.project_team_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_user_id ON public.project_team_members(user_id);

ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read project team members" ON public.project_team_members;
DROP POLICY IF EXISTS "Users can insert project team members" ON public.project_team_members;
DROP POLICY IF EXISTS "Users can delete project team members" ON public.project_team_members;

CREATE POLICY "Users can read project team members"
  ON public.project_team_members
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
          OR project_team_members.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Users can insert project team members"
  ON public.project_team_members
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

CREATE POLICY "Users can delete project team members"
  ON public.project_team_members
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

-- 5. Update projects RLS to allow assigned staff
DROP POLICY IF EXISTS "Users with projects read access can read projects" ON public.projects;
DROP POLICY IF EXISTS "Users with projects write access can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Users with projects write access can update projects" ON public.projects;
DROP POLICY IF EXISTS "Users with projects write access can delete projects" ON public.projects;

CREATE POLICY "Users with projects read access can read projects"
  ON public.projects
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
      WHERE ptm.project_id = projects.id
        AND ptm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users with projects write access can insert projects"
  ON public.projects
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

CREATE POLICY "Users with projects write access can update projects"
  ON public.projects
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
    OR EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = projects.id
        AND ptm.user_id = auth.uid()
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
    OR EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = projects.id
        AND ptm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users with projects write access can delete projects"
  ON public.projects
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

-- 6. Update project_followups RLS to allow assigned staff
DROP POLICY IF EXISTS "Users can read project follow-ups" ON public.project_followups;
DROP POLICY IF EXISTS "Users can insert project follow-ups" ON public.project_followups;
DROP POLICY IF EXISTS "Users can update project follow-ups" ON public.project_followups;
DROP POLICY IF EXISTS "Users can delete project follow-ups" ON public.project_followups;

CREATE POLICY "Users can read project follow-ups"
  ON public.project_followups
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
      WHERE ptm.project_id = project_followups.project_id
        AND ptm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert project follow-ups"
  ON public.project_followups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND (
            u.role IN ('admin', 'manager')
            OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_team_members ptm
        WHERE ptm.project_id = project_followups.project_id
          AND ptm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update project follow-ups"
  ON public.project_followups
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
    OR EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = project_followups.project_id
        AND ptm.user_id = auth.uid()
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
    OR EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = project_followups.project_id
        AND ptm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete project follow-ups"
  ON public.project_followups
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
    OR EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = project_followups.project_id
        AND ptm.user_id = auth.uid()
    )
  );
