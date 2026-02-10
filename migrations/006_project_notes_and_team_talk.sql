-- Migration 006: Project personal notes, note attachments, team talk messages and attachments
-- Consolidates: 012_project_my_notes, 013_project_my_notes_attachments,
-- 014_project_team_talk, 015_project_team_talk_attachments, 016_team_talk_policy_updates.
-- Team talk update/delete restricted to message/attachment owner.
-- Depends on: 005_project_management (project_team_members).

-- 1. Project user notes (my notes)
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

-- 2. Project note attachments
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

-- 3. Project team talk messages
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

-- Update/delete: owner only (016)
CREATE POLICY "Users can update project team talk messages"
  ON public.project_team_talk_messages
  FOR UPDATE
  TO authenticated
  USING (
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
  )
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

CREATE POLICY "Users can delete project team talk messages"
  ON public.project_team_talk_messages
  FOR DELETE
  TO authenticated
  USING (
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

-- 4. Project team talk attachments
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

-- Update/delete: owner only (016)
CREATE POLICY "Users can update project team talk attachments"
  ON public.project_team_talk_attachments
  FOR UPDATE
  TO authenticated
  USING (
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
  )
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

CREATE POLICY "Users can delete project team talk attachments"
  ON public.project_team_talk_attachments
  FOR DELETE
  TO authenticated
  USING (
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
