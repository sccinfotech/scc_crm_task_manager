-- Migration 009: Allow staff to update project_tasks (e.g. status) when they are project team members.
-- Application layer (tasks-actions.ts) restricts staff to status updates only; RLS allows the row update.

DROP POLICY IF EXISTS "Staff can update project tasks when in project" ON public.project_tasks;

CREATE POLICY "Staff can update project tasks when in project"
  ON public.project_tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'staff'
    )
    AND EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = project_tasks.project_id
        AND ptm.user_id = auth.uid()
    )
  )
  WITH CHECK (true);
