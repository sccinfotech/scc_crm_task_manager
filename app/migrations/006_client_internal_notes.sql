-- Migration 006: Client Internal Notes
-- This file creates tables for client internal notes and attachments with admin/manager-only access.

-- 1. Client Internal Notes Table
CREATE TABLE IF NOT EXISTS public.client_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  note_text TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Client Internal Notes Indexes
CREATE INDEX IF NOT EXISTS idx_client_internal_notes_client_id ON public.client_internal_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_internal_notes_created_at ON public.client_internal_notes(created_at);

-- 3. Client Internal Notes Row Level Security
ALTER TABLE public.client_internal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can read internal notes" ON public.client_internal_notes;
DROP POLICY IF EXISTS "Admins and managers can insert internal notes" ON public.client_internal_notes;
DROP POLICY IF EXISTS "Admins and managers can update internal notes" ON public.client_internal_notes;
DROP POLICY IF EXISTS "Admins and managers can delete internal notes" ON public.client_internal_notes;

CREATE POLICY "Admins and managers can read internal notes"
  ON public.client_internal_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can insert internal notes"
  ON public.client_internal_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update internal notes"
  ON public.client_internal_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can delete internal notes"
  ON public.client_internal_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

-- 4. Client Internal Notes Trigger
DROP TRIGGER IF EXISTS update_client_internal_notes_updated_at ON public.client_internal_notes;
CREATE TRIGGER update_client_internal_notes_updated_at
  BEFORE UPDATE ON public.client_internal_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Client Note Attachments Table
CREATE TABLE IF NOT EXISTS public.client_note_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.client_internal_notes(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'image',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 6. Client Note Attachments Indexes
CREATE INDEX IF NOT EXISTS idx_client_note_attachments_note_id ON public.client_note_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_client_note_attachments_client_id ON public.client_note_attachments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_note_attachments_created_at ON public.client_note_attachments(created_at);

-- 7. Client Note Attachments Row Level Security
ALTER TABLE public.client_note_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can read note attachments" ON public.client_note_attachments;
DROP POLICY IF EXISTS "Admins and managers can insert note attachments" ON public.client_note_attachments;
DROP POLICY IF EXISTS "Admins and managers can update note attachments" ON public.client_note_attachments;
DROP POLICY IF EXISTS "Admins and managers can delete note attachments" ON public.client_note_attachments;

CREATE POLICY "Admins and managers can read note attachments"
  ON public.client_note_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can insert note attachments"
  ON public.client_note_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update note attachments"
  ON public.client_note_attachments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can delete note attachments"
  ON public.client_note_attachments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );
