-- Migration 006: Project updates + Technology & Tools master
-- Depends on: 001_auth_user_management, 003_client_management, 005_project_management

-- 1. Technology & Tools Master Table
CREATE TABLE IF NOT EXISTS public.technology_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_technology_tools_name_unique ON public.technology_tools (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_technology_tools_is_active ON public.technology_tools(is_active);
CREATE INDEX IF NOT EXISTS idx_technology_tools_created_by ON public.technology_tools(created_by);

ALTER TABLE public.technology_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read technology tools" ON public.technology_tools;
DROP POLICY IF EXISTS "Users can insert technology tools" ON public.technology_tools;
DROP POLICY IF EXISTS "Users can update technology tools" ON public.technology_tools;
DROP POLICY IF EXISTS "Users can delete technology tools" ON public.technology_tools;

-- Read: settings read/write OR projects read/write OR admin/manager
CREATE POLICY "Users can read technology tools"
  ON public.technology_tools
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'settings', 'none') IN ('read', 'write')
          OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
        )
    )
  );

-- Write: settings write OR admin/manager
CREATE POLICY "Users can insert technology tools"
  ON public.technology_tools
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
          OR COALESCE(u.module_permissions->>'settings', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users can update technology tools"
  ON public.technology_tools
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'settings', 'none') = 'write'
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
          OR COALESCE(u.module_permissions->>'settings', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users can delete technology tools"
  ON public.technology_tools
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'settings', 'none') = 'write'
        )
    )
  );

DROP TRIGGER IF EXISTS update_technology_tools_updated_at ON public.technology_tools;
CREATE TRIGGER update_technology_tools_updated_at
  BEFORE UPDATE ON public.technology_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Project <-> Technology Tools Join Table
CREATE TABLE IF NOT EXISTS public.project_technology_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  technology_tool_id UUID NOT NULL REFERENCES public.technology_tools(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT project_technology_tools_unique UNIQUE (project_id, technology_tool_id)
);

CREATE INDEX IF NOT EXISTS idx_project_technology_tools_project_id ON public.project_technology_tools(project_id);
CREATE INDEX IF NOT EXISTS idx_project_technology_tools_tool_id ON public.project_technology_tools(technology_tool_id);

ALTER TABLE public.project_technology_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read project technology tools" ON public.project_technology_tools;
DROP POLICY IF EXISTS "Users can insert project technology tools" ON public.project_technology_tools;
DROP POLICY IF EXISTS "Users can update project technology tools" ON public.project_technology_tools;
DROP POLICY IF EXISTS "Users can delete project technology tools" ON public.project_technology_tools;

CREATE POLICY "Users can read project technology tools"
  ON public.project_technology_tools
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

CREATE POLICY "Users can insert project technology tools"
  ON public.project_technology_tools
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

CREATE POLICY "Users can update project technology tools"
  ON public.project_technology_tools
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

CREATE POLICY "Users can delete project technology tools"
  ON public.project_technology_tools
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

-- 3. Project Field Updates
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS developer_deadline_date DATE,
  ADD COLUMN IF NOT EXISTS client_deadline_date DATE,
  ADD COLUMN IF NOT EXISTS staff_status TEXT NOT NULL DEFAULT 'start',
  ADD COLUMN IF NOT EXISTS website_links TEXT;

-- Update existing status values to new client status values
UPDATE public.projects
SET status = CASE
  WHEN status = 'not_started' THEN 'pending'
  WHEN status = 'on_hold' THEN 'hold'
  ELSE status
END
WHERE status IN ('not_started', 'on_hold');

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('pending', 'in_progress', 'hold', 'completed'));

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_staff_status_check;
ALTER TABLE public.projects
ADD CONSTRAINT projects_staff_status_check
CHECK (staff_status IN ('start', 'hold', 'end'));

CREATE INDEX IF NOT EXISTS idx_projects_staff_status ON public.projects(staff_status);
CREATE INDEX IF NOT EXISTS idx_projects_developer_deadline_date ON public.projects(developer_deadline_date);
CREATE INDEX IF NOT EXISTS idx_projects_client_deadline_date ON public.projects(client_deadline_date);
