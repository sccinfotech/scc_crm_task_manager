-- Migration 012: Project personal notes (staff-only)
-- Depends on: 010_project_team_member_work

CREATE TABLE IF NOT EXISTS public.project_user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_user_notes_project_id ON public.project_user_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_user_notes_user_id ON public.project_user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_project_user_notes_created_at ON public.project_user_notes(created_at);

DROP TRIGGER IF EXISTS update_project_user_notes_updated_at ON public.project_user_notes;
CREATE TRIGGER update_project_user_notes_updated_at
  BEFORE UPDATE ON public.project_user_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.project_user_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own project notes" ON public.project_user_notes;
DROP POLICY IF EXISTS "Users can insert own project notes" ON public.project_user_notes;
DROP POLICY IF EXISTS "Users can update own project notes" ON public.project_user_notes;
DROP POLICY IF EXISTS "Users can delete own project notes" ON public.project_user_notes;

CREATE POLICY "Users can read own project notes"
  ON public.project_user_notes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
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
              WHERE ptm.project_id = project_user_notes.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can insert own project notes"
  ON public.project_user_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
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
              WHERE ptm.project_id = project_user_notes.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can update own project notes"
  ON public.project_user_notes
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
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
              WHERE ptm.project_id = project_user_notes.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
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
              WHERE ptm.project_id = project_user_notes.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can delete own project notes"
  ON public.project_user_notes
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
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
              WHERE ptm.project_id = project_user_notes.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );
