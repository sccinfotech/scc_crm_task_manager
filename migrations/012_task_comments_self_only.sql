-- Migration 012: Enforce self-only updates/deletes for task comments and comment attachments.

-- Task comments: only creator can update/delete.
DROP POLICY IF EXISTS "Users can update task comments" ON public.project_task_comments;
DROP POLICY IF EXISTS "Users can delete task comments" ON public.project_task_comments;

CREATE POLICY "Users can update task comments"
  ON public.project_task_comments
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete task comments"
  ON public.project_task_comments
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Task comment attachments: only creator can update/delete.
DROP POLICY IF EXISTS "Users can update task comment attachments" ON public.project_task_comment_attachments;
DROP POLICY IF EXISTS "Users can delete task comment attachments" ON public.project_task_comment_attachments;

CREATE POLICY "Users can update task comment attachments"
  ON public.project_task_comment_attachments
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete task comment attachments"
  ON public.project_task_comment_attachments
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
