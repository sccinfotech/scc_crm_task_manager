-- Migration 019: RPC function for first-login UUID sync
--
-- Problem:
--   Admins pre-add users with a placeholder UUID (no auth account yet).
--   On first Google OAuth login, auth.users gets a NEW UUID.
--   The OAuth callback must update public.users.id (primary key) to match
--   the real auth UUID so subsequent logins find the user by id.
--
--   PostgREST blocks primary-key updates via the REST API, so we need
--   a SECURITY DEFINER SQL function that the service role can call via RPC.
--
-- Usage (from the OAuth callback via supabaseAdmin.rpc):
--   SELECT sync_user_auth_id('old-placeholder-uuid', 'new-google-auth-uuid');

CREATE OR REPLACE FUNCTION public.sync_user_auth_id(
  p_old_id UUID,
  p_new_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    id         = p_new_id,
    updated_at = NOW()
  WHERE id = p_old_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sync_user_auth_id: no user found with id = %', p_old_id;
  END IF;
END;
$$;

-- Only service-role (used by admin client) should call this.
-- Revoke from public / anon, keep for authenticated callers going through service role.
REVOKE EXECUTE ON FUNCTION public.sync_user_auth_id(UUID, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.sync_user_auth_id(UUID, UUID) TO authenticated, service_role;
