-- Migration 029: Allow project write staff to read clients for project creation
-- Problem:
-- Staff users were allowed in the app to create projects when `module_permissions->>'projects' = 'write`,
-- but the `public.clients` SELECT RLS policy only allowed reads when `module_permissions->>'customers'`
-- was `read/write` (or role was admin/manager). This blocked the client dropdown.
--
-- Fix:
-- Extend the existing clients SELECT policy to also allow access when the user has
-- `module_permissions->>'projects'` = `read` or `write`.

BEGIN;

DROP POLICY IF EXISTS "Users with customers read access can read clients" ON public.clients;

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
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'customers', 'none') IN ('read', 'write')
          OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
        )
    )
  );

COMMIT;

