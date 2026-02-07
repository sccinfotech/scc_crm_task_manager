-- Migration 005: Project Management
-- Adds projects and project follow-ups with RLS.
-- Depends on: 001_auth_user_management, 003_client_management.

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  start_date DATE NOT NULL,
  expected_end_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT projects_expected_end_date_check CHECK (expected_end_date >= start_date),
  CONSTRAINT projects_amount_check CHECK (project_amount >= 0)
);

-- 2. Projects Status Constraint
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('not_started', 'in_progress', 'on_hold', 'completed'));

-- 3. Projects Indexes
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON public.projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_expected_end_date ON public.projects(expected_end_date);

-- 4. Projects Row Level Security (module_permissions: projects read/write)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

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
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
        )
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
          u.role = 'admin'
          OR u.role = 'manager'
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
          u.role = 'admin'
          OR u.role = 'manager'
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
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
        )
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
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
        )
    )
  );

-- 5. Projects updated_at Trigger
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Project Follow-Ups Table
CREATE TABLE IF NOT EXISTS public.project_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  follow_up_date DATE,
  next_follow_up_date DATE,
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT project_followups_any_field_check CHECK (
    note IS NOT NULL OR follow_up_date IS NOT NULL OR next_follow_up_date IS NOT NULL
  )
);

-- 7. Project Follow-Ups Indexes
CREATE INDEX IF NOT EXISTS idx_project_followups_project_id ON public.project_followups(project_id);
CREATE INDEX IF NOT EXISTS idx_project_followups_created_by ON public.project_followups(created_by);
CREATE INDEX IF NOT EXISTS idx_project_followups_follow_up_date ON public.project_followups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_project_followups_next_follow_up_date ON public.project_followups(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_project_followups_created_at ON public.project_followups(created_at);

-- 8. Project Follow-Ups updated_at Trigger
DROP TRIGGER IF EXISTS update_project_followups_updated_at ON public.project_followups;
CREATE TRIGGER update_project_followups_updated_at
  BEFORE UPDATE ON public.project_followups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Project Follow-Ups Row Level Security (module: projects)
ALTER TABLE public.project_followups ENABLE ROW LEVEL SECURITY;

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
  );

CREATE POLICY "Users can insert project follow-ups"
  ON public.project_followups
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
  );
