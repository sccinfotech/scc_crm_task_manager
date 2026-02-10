-- Migration 005: Project Management
-- Consolidates: projects, project_followups, technology_tools, project_technology_tools,
-- project_team_members (with work tracking), project_team_member_time_events, and all RLS.
-- Final schema: no expected_end_date; project_amount TEXT (nullable, app-encrypted); status pending|in_progress|hold|completed.
-- Depends on: 001_auth_user_management, 003_client_management.

-- 1. Projects Table (final schema: 005+006+007+008+009 merged)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_amount TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  start_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  developer_deadline_date DATE,
  client_deadline_date DATE,
  staff_status TEXT NOT NULL DEFAULT 'start',
  website_links TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  reference_links TEXT,
  CONSTRAINT projects_status_check CHECK (status IN ('pending', 'in_progress', 'hold', 'completed')),
  CONSTRAINT projects_staff_status_check CHECK (staff_status IN ('start', 'hold', 'end')),
  CONSTRAINT projects_priority_check CHECK (priority IN ('urgent', 'high', 'medium', 'low'))
);

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON public.projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_staff_status ON public.projects(staff_status);
CREATE INDEX IF NOT EXISTS idx_projects_developer_deadline_date ON public.projects(developer_deadline_date);
CREATE INDEX IF NOT EXISTS idx_projects_client_deadline_date ON public.projects(client_deadline_date);

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Project Follow-Ups Table
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

CREATE INDEX IF NOT EXISTS idx_project_followups_project_id ON public.project_followups(project_id);
CREATE INDEX IF NOT EXISTS idx_project_followups_created_by ON public.project_followups(created_by);
CREATE INDEX IF NOT EXISTS idx_project_followups_follow_up_date ON public.project_followups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_project_followups_next_follow_up_date ON public.project_followups(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_project_followups_created_at ON public.project_followups(created_at);

DROP TRIGGER IF EXISTS update_project_followups_updated_at ON public.project_followups;
CREATE TRIGGER update_project_followups_updated_at
  BEFORE UPDATE ON public.project_followups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. Technology & Tools Master Table
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
          u.role IN ('admin', 'manager', 'staff')
          OR COALESCE(u.module_permissions->>'settings', 'none') IN ('read', 'write')
          OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
        )
    )
  );

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

-- 4. Project <-> Technology Tools Join Table
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
          OR EXISTS (
            SELECT 1
            FROM public.project_team_members ptm
            WHERE ptm.project_id = project_technology_tools.project_id
              AND ptm.user_id = auth.uid()
          )
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

-- 5. Project Team Members (with work tracking)
CREATE TABLE IF NOT EXISTS public.project_team_members (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  work_status TEXT NOT NULL DEFAULT 'not_started',
  work_started_at TIMESTAMP WITH TIME ZONE,
  work_ended_at TIMESTAMP WITH TIME ZONE,
  work_done_notes TEXT,
  PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_team_members_work_status_check CHECK (work_status IN ('not_started', 'start', 'hold', 'end'))
);

CREATE INDEX IF NOT EXISTS idx_project_team_members_project_id ON public.project_team_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_user_id ON public.project_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_work_status ON public.project_team_members(work_status);

ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read project team members" ON public.project_team_members;
DROP POLICY IF EXISTS "Users can insert project team members" ON public.project_team_members;
DROP POLICY IF EXISTS "Users can delete project team members" ON public.project_team_members;
DROP POLICY IF EXISTS "Assigned staff can update own work status" ON public.project_team_members;

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

CREATE POLICY "Assigned staff can update own work status"
  ON public.project_team_members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Projects RLS (depends on project_team_members)
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

-- Project follow-ups RLS (depends on project_team_members)
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

-- 6. Project Team Member Time Events
CREATE TABLE IF NOT EXISTS public.project_team_member_time_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('start', 'hold', 'resume', 'end')),
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ptmte_project_user ON public.project_team_member_time_events(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ptmte_occurred_at ON public.project_team_member_time_events(occurred_at);

ALTER TABLE public.project_team_member_time_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read project team member time events" ON public.project_team_member_time_events;
DROP POLICY IF EXISTS "Assigned staff can insert own time events" ON public.project_team_member_time_events;

CREATE POLICY "Users can read project team member time events"
  ON public.project_team_member_time_events
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
          OR project_team_member_time_events.user_id = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = project_team_member_time_events.project_id
        AND ptm.user_id = auth.uid()
    )
  );

CREATE POLICY "Assigned staff can insert own time events"
  ON public.project_team_member_time_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = project_team_member_time_events.project_id
        AND ptm.user_id = auth.uid()
    )
  );
