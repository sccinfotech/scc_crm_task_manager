-- Migration 013: Project personal note attachments
-- Depends on: 012_project_my_notes

CREATE TABLE IF NOT EXISTS public.project_note_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.project_user_notes(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_project_note_attachments_note_id ON public.project_note_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_project_note_attachments_project_id ON public.project_note_attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_note_attachments_created_at ON public.project_note_attachments(created_at);

ALTER TABLE public.project_note_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own project note attachments" ON public.project_note_attachments;
DROP POLICY IF EXISTS "Users can insert own project note attachments" ON public.project_note_attachments;
DROP POLICY IF EXISTS "Users can update own project note attachments" ON public.project_note_attachments;
DROP POLICY IF EXISTS "Users can delete own project note attachments" ON public.project_note_attachments;

CREATE POLICY "Users can read own project note attachments"
  ON public.project_note_attachments
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.project_user_notes pun
      WHERE pun.id = project_note_attachments.note_id
        AND pun.project_id = project_note_attachments.project_id
        AND pun.user_id = auth.uid()
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
              WHERE ptm.project_id = project_note_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can insert own project note attachments"
  ON public.project_note_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.project_user_notes pun
      WHERE pun.id = project_note_attachments.note_id
        AND pun.project_id = project_note_attachments.project_id
        AND pun.user_id = auth.uid()
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
              WHERE ptm.project_id = project_note_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can update own project note attachments"
  ON public.project_note_attachments
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.project_user_notes pun
      WHERE pun.id = project_note_attachments.note_id
        AND pun.project_id = project_note_attachments.project_id
        AND pun.user_id = auth.uid()
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
              WHERE ptm.project_id = project_note_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.project_user_notes pun
      WHERE pun.id = project_note_attachments.note_id
        AND pun.project_id = project_note_attachments.project_id
        AND pun.user_id = auth.uid()
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
              WHERE ptm.project_id = project_note_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can delete own project note attachments"
  ON public.project_note_attachments
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.project_user_notes pun
      WHERE pun.id = project_note_attachments.note_id
        AND pun.project_id = project_note_attachments.project_id
        AND pun.user_id = auth.uid()
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
              WHERE ptm.project_id = project_note_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );
