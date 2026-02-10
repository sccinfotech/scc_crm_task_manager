-- Migration 015: Project team talk attachments
-- Depends on: 014_project_team_talk

CREATE TABLE IF NOT EXISTS public.project_team_talk_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.project_team_talk_messages(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'image',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_team_talk_attachments_message_id ON public.project_team_talk_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_project_team_talk_attachments_project_id ON public.project_team_talk_attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_talk_attachments_created_at ON public.project_team_talk_attachments(created_at);

ALTER TABLE public.project_team_talk_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read project team talk attachments" ON public.project_team_talk_attachments;
DROP POLICY IF EXISTS "Users can insert project team talk attachments" ON public.project_team_talk_attachments;
DROP POLICY IF EXISTS "Users can update project team talk attachments" ON public.project_team_talk_attachments;
DROP POLICY IF EXISTS "Users can delete project team talk attachments" ON public.project_team_talk_attachments;

CREATE POLICY "Users can read project team talk attachments"
  ON public.project_team_talk_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_team_talk_messages m
      WHERE m.id = project_team_talk_attachments.message_id
        AND m.project_id = project_team_talk_attachments.project_id
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
              WHERE ptm.project_id = project_team_talk_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can insert project team talk attachments"
  ON public.project_team_talk_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.project_team_talk_messages m
      WHERE m.id = project_team_talk_attachments.message_id
        AND m.project_id = project_team_talk_attachments.project_id
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
              WHERE ptm.project_id = project_team_talk_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can update project team talk attachments"
  ON public.project_team_talk_attachments
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
      FROM public.project_team_talk_messages m
      WHERE m.id = project_team_talk_attachments.message_id
        AND m.project_id = project_team_talk_attachments.project_id
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
              WHERE ptm.project_id = project_team_talk_attachments.project_id
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
      FROM public.project_team_talk_messages m
      WHERE m.id = project_team_talk_attachments.message_id
        AND m.project_id = project_team_talk_attachments.project_id
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
              WHERE ptm.project_id = project_team_talk_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can delete project team talk attachments"
  ON public.project_team_talk_attachments
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
      FROM public.project_team_talk_messages m
      WHERE m.id = project_team_talk_attachments.message_id
        AND m.project_id = project_team_talk_attachments.project_id
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
              WHERE ptm.project_id = project_team_talk_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );
