-- Migration 027: Add dedicated project_tasks module permission for task-tab-only access.
-- This keeps project management and task management separate:
-- - projects: project/module CRUD and non-task tabs
-- - project_tasks: task-tab read/write access

BEGIN;

-- Allow task-only users to read project rows so the Projects list/detail page can open,
-- while the application limits them to the Tasks tab.
DROP POLICY IF EXISTS "Users with projects read access can read projects" ON public.projects;

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
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') IN ('read', 'write')
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = projects.id
        AND ptm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can read project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins can insert project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins can update project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins can delete project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Users with task write access can insert project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Users with task write access can update project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Users with task write access can delete project tasks" ON public.project_tasks;

CREATE POLICY "Users can read project tasks"
  ON public.project_tasks
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
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') IN ('read', 'write')
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = project_tasks.project_id
        AND ptm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.projects p ON p.id = project_tasks.project_id
      JOIN public.clients c ON c.id = p.client_id
      WHERE u.id = auth.uid()
        AND u.role = 'client'
        AND c.email = u.email
        AND project_tasks.status = 'completed'
    )
  );

CREATE POLICY "Users with task write access can insert project tasks"
  ON public.project_tasks
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
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with task write access can update project tasks"
  ON public.project_tasks
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
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') = 'write'
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
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with task write access can delete project tasks"
  ON public.project_tasks
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
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') = 'write'
        )
    )
  );

DROP POLICY IF EXISTS "Users can read task assignees" ON public.project_task_assignees;
DROP POLICY IF EXISTS "Admins can manage task assignees" ON public.project_task_assignees;
DROP POLICY IF EXISTS "Users with task write access can manage task assignees" ON public.project_task_assignees;

CREATE POLICY "Users can read task assignees"
  ON public.project_task_assignees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = project_task_assignees.task_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                u.role IN ('admin', 'manager')
                OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
                OR COALESCE(u.module_permissions->>'project_tasks', 'none') IN ('read', 'write')
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.project_team_members ptm
            WHERE ptm.project_id = t.project_id
              AND ptm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.users u
            JOIN public.projects p ON p.id = t.project_id
            JOIN public.clients c ON c.id = p.client_id
            WHERE u.id = auth.uid()
              AND u.role = 'client'
              AND c.email = u.email
              AND t.status = 'completed'
          )
        )
    )
  );

CREATE POLICY "Users with task write access can manage task assignees"
  ON public.project_task_assignees
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') = 'write'
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
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') = 'write'
        )
    )
  );

DROP POLICY IF EXISTS "Users can read task comments" ON public.project_task_comments;

CREATE POLICY "Users can read task comments"
  ON public.project_task_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = project_task_comments.task_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                u.role IN ('admin', 'manager')
                OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
                OR COALESCE(u.module_permissions->>'project_tasks', 'none') IN ('read', 'write')
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.project_team_members ptm
            WHERE ptm.project_id = t.project_id
              AND ptm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.users u
            JOIN public.projects p ON p.id = t.project_id
            JOIN public.clients c ON c.id = p.client_id
            WHERE u.id = auth.uid()
              AND u.role = 'client'
              AND c.email = u.email
              AND t.status = 'completed'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can read task attachments" ON public.project_task_attachments;
DROP POLICY IF EXISTS "Admins can manage task attachments" ON public.project_task_attachments;
DROP POLICY IF EXISTS "Users with task write access can manage task attachments" ON public.project_task_attachments;

CREATE POLICY "Users can read task attachments"
  ON public.project_task_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = project_task_attachments.task_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                u.role IN ('admin', 'manager')
                OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
                OR COALESCE(u.module_permissions->>'project_tasks', 'none') IN ('read', 'write')
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.project_team_members ptm
            WHERE ptm.project_id = t.project_id
              AND ptm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.users u
            JOIN public.projects p ON p.id = t.project_id
            JOIN public.clients c ON c.id = p.client_id
            WHERE u.id = auth.uid()
              AND u.role = 'client'
              AND c.email = u.email
              AND t.status = 'completed'
          )
        )
    )
  );

CREATE POLICY "Users with task write access can manage task attachments"
  ON public.project_task_attachments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') = 'write'
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
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') = 'write'
        )
    )
  );

DROP POLICY IF EXISTS "Users can read task activity" ON public.project_task_activity_log;

CREATE POLICY "Users can read task activity"
  ON public.project_task_activity_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = project_task_activity_log.task_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                u.role IN ('admin', 'manager')
                OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
                OR COALESCE(u.module_permissions->>'project_tasks', 'none') IN ('read', 'write')
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.project_team_members ptm
            WHERE ptm.project_id = t.project_id
              AND ptm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.users u
            JOIN public.projects p ON p.id = t.project_id
            JOIN public.clients c ON c.id = p.client_id
            WHERE u.id = auth.uid()
              AND u.role = 'client'
              AND c.email = u.email
              AND t.status = 'completed'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can read task comment attachments" ON public.project_task_comment_attachments;
DROP POLICY IF EXISTS "Users can insert task comment attachments" ON public.project_task_comment_attachments;

CREATE POLICY "Users can read task comment attachments"
  ON public.project_task_comment_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = project_task_comment_attachments.task_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                u.role IN ('admin', 'manager')
                OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
                OR COALESCE(u.module_permissions->>'project_tasks', 'none') IN ('read', 'write')
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.project_team_members ptm
            WHERE ptm.project_id = t.project_id
              AND ptm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.users u
            JOIN public.projects p ON p.id = t.project_id
            JOIN public.clients c ON c.id = p.client_id
            WHERE u.id = auth.uid()
              AND u.role = 'client'
              AND c.email = u.email
              AND t.status = 'completed'
          )
        )
    )
  );

CREATE POLICY "Users can insert task comment attachments"
  ON public.project_task_comment_attachments
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
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') = 'write'
          OR (
            u.role = 'staff'
            AND EXISTS (
              SELECT 1
              FROM public.project_team_members ptm
              WHERE ptm.project_id = project_task_comment_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.project_task_comments c
      WHERE c.id = project_task_comment_attachments.comment_id
        AND c.task_id = project_task_comment_attachments.task_id
    )
  );

COMMIT;
