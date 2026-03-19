-- Migration 028: Task comment reactions
-- Adds emoji reactions to project task comments.

CREATE TABLE IF NOT EXISTS public.project_task_comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.project_task_comments(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT project_task_comment_reactions_unique_user_emoji
    UNIQUE (comment_id, created_by, emoji),
  CONSTRAINT project_task_comment_reactions_emoji_not_blank
    CHECK (char_length(btrim(emoji)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_project_task_comment_reactions_comment_id
  ON public.project_task_comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_project_task_comment_reactions_task_id
  ON public.project_task_comment_reactions(task_id);
CREATE INDEX IF NOT EXISTS idx_project_task_comment_reactions_created_by
  ON public.project_task_comment_reactions(created_by);

ALTER TABLE public.project_task_comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read task comment reactions" ON public.project_task_comment_reactions;
DROP POLICY IF EXISTS "Users can insert task comment reactions" ON public.project_task_comment_reactions;
DROP POLICY IF EXISTS "Users can delete task comment reactions" ON public.project_task_comment_reactions;

CREATE POLICY "Users can read task comment reactions"
  ON public.project_task_comment_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = project_task_comment_reactions.task_id
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

CREATE POLICY "Users can insert task comment reactions"
  ON public.project_task_comment_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.project_task_comments c
      WHERE c.id = project_task_comment_reactions.comment_id
        AND c.task_id = project_task_comment_reactions.task_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.project_tasks t
      JOIN public.users u ON u.id = auth.uid()
      WHERE t.id = project_task_comment_reactions.task_id
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'projects', 'none') = 'write'
          OR COALESCE(u.module_permissions->>'project_tasks', 'none') = 'write'
          OR (
            u.role = 'staff'
            AND EXISTS (
              SELECT 1
              FROM public.project_team_members ptm
              WHERE ptm.project_id = t.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can delete task comment reactions"
  ON public.project_task_comment_reactions
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
