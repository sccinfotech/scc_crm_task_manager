-- Migration 014: Project team talk messages
-- Depends on: 010_project_team_member_work

CREATE TABLE IF NOT EXISTS public.project_team_talk_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_team_talk_messages_project_id ON public.project_team_talk_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_talk_messages_created_by ON public.project_team_talk_messages(created_by);
CREATE INDEX IF NOT EXISTS idx_project_team_talk_messages_created_at ON public.project_team_talk_messages(created_at);

DROP TRIGGER IF EXISTS update_project_team_talk_messages_updated_at ON public.project_team_talk_messages;
CREATE TRIGGER update_project_team_talk_messages_updated_at
  BEFORE UPDATE ON public.project_team_talk_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.project_team_talk_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read project team talk messages" ON public.project_team_talk_messages;
DROP POLICY IF EXISTS "Users can insert project team talk messages" ON public.project_team_talk_messages;
DROP POLICY IF EXISTS "Users can update project team talk messages" ON public.project_team_talk_messages;
DROP POLICY IF EXISTS "Users can delete project team talk messages" ON public.project_team_talk_messages;

CREATE POLICY "Users can read project team talk messages"
  ON public.project_team_talk_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
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
              WHERE ptm.project_id = project_team_talk_messages.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can insert project team talk messages"
  ON public.project_team_talk_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
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
              WHERE ptm.project_id = project_team_talk_messages.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can update project team talk messages"
  ON public.project_team_talk_messages
  FOR UPDATE
  TO authenticated
  USING (
    (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'manager')
      )
    )
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
              WHERE ptm.project_id = project_team_talk_messages.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  )
  WITH CHECK (
    (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'manager')
      )
    )
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
              WHERE ptm.project_id = project_team_talk_messages.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can delete project team talk messages"
  ON public.project_team_talk_messages
  FOR DELETE
  TO authenticated
  USING (
    (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'manager')
      )
    )
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
              WHERE ptm.project_id = project_team_talk_messages.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );
