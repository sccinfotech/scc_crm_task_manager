-- Migration 003: Client Management
-- Consolidates clients, client internal notes, and note attachments with RLS.
-- Depends on: 001_auth_user_management, 002_lead_management (leads for lead_id).

-- 1. Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  remark TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Clients Constraint
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE public.clients
ADD CONSTRAINT clients_status_check
CHECK (status IN ('active', 'inactive'));

-- 3. Clients Indexes
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_lead_id ON public.clients(lead_id) WHERE lead_id IS NOT NULL;

-- 4. Clients Row Level Security (module_permissions: customers read/write)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Users can read own clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can read all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can update all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete all clients" ON public.clients;
DROP POLICY IF EXISTS "Users with customers read access can read clients" ON public.clients;
DROP POLICY IF EXISTS "Users with customers write access can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Users with customers write access can update clients" ON public.clients;
DROP POLICY IF EXISTS "Users with customers write access can delete clients" ON public.clients;

CREATE POLICY "Users with customers read access can read clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'customers', 'none') IN ('read', 'write')
        )
    )
  );

CREATE POLICY "Users with customers write access can insert clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'customers', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with customers write access can update clients"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'customers', 'none') = 'write'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'customers', 'none') = 'write'
        )
    )
  );

CREATE POLICY "Users with customers write access can delete clients"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'admin'
          OR u.role = 'manager'
          OR COALESCE(u.module_permissions->>'customers', 'none') = 'write'
        )
    )
  );

-- 5. Clients updated_at Trigger
DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Client Internal Notes Table
CREATE TABLE IF NOT EXISTS public.client_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  note_text TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_internal_notes_client_id ON public.client_internal_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_internal_notes_created_at ON public.client_internal_notes(created_at);

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

DROP TRIGGER IF EXISTS update_client_internal_notes_updated_at ON public.client_internal_notes;
CREATE TRIGGER update_client_internal_notes_updated_at
  BEFORE UPDATE ON public.client_internal_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Client Note Attachments Table
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

CREATE INDEX IF NOT EXISTS idx_client_note_attachments_note_id ON public.client_note_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_client_note_attachments_client_id ON public.client_note_attachments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_note_attachments_created_at ON public.client_note_attachments(created_at);

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
