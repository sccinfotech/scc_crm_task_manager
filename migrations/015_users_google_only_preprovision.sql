-- Migration 015: Google-only provisioning for pre-added users
--
-- Goal:
-- - Allow admin to pre-add user profiles without creating email/password auth accounts.
-- - Keep first account creation in auth.users tied to actual Google OAuth login.
--
-- Approach:
-- - Remove the direct FK from public.users.id -> auth.users.id so a profile can exist before first login.
-- - Keep id as UUID primary key and auto-generate it for pre-provisioned profiles.
-- - During OAuth callback, app code maps profile row by email and updates id to Google auth user id.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
