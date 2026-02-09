-- Migration 011: Allow staff to see Technology & Tools on project detail
-- Staff can view projects they are assigned to; they were blocked from reading
-- project_technology_tools and (when no projects module permission) technology_tools.
-- This migration fixes RLS so staff see selected technology & tools on project detail.

-- 1. project_technology_tools: allow staff to read rows for projects they're assigned to
DROP POLICY IF EXISTS "Users can read project technology tools" ON public.project_technology_tools;
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

-- 2. technology_tools: allow staff to read so they can see tool names on project detail
DROP POLICY IF EXISTS "Users can read technology tools" ON public.technology_tools;
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
