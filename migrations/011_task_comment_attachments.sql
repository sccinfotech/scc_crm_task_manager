-- Migration 011: Task comment attachments
-- Adds attachment support scoped to task comments.

CREATE TABLE IF NOT EXISTS public.project_task_comment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.project_task_comments(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'raw',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_task_comment_attachments_comment_id
  ON public.project_task_comment_attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_project_task_comment_attachments_task_id
  ON public.project_task_comment_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_project_task_comment_attachments_project_id
  ON public.project_task_comment_attachments(project_id);

ALTER TABLE public.project_task_comment_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read task comment attachments" ON public.project_task_comment_attachments;
DROP POLICY IF EXISTS "Users can insert task comment attachments" ON public.project_task_comment_attachments;
DROP POLICY IF EXISTS "Users can update task comment attachments" ON public.project_task_comment_attachments;
DROP POLICY IF EXISTS "Users can delete task comment attachments" ON public.project_task_comment_attachments;

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

CREATE POLICY "Users can update task comment attachments"
  ON public.project_task_comment_attachments
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can delete task comment attachments"
  ON public.project_task_comment_attachments
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );
