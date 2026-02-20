-- Migration 014: User profile fields + Google allowlist provisioning hardening

-- 1) Extend users profile schema
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS joining_date DATE,
  ADD COLUMN IF NOT EXISTS personal_email TEXT,
  ADD COLUMN IF NOT EXISTS personal_mobile_no TEXT,
  ADD COLUMN IF NOT EXISTS home_mobile_no TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2) New users should be inactive by default unless explicitly activated
ALTER TABLE public.users
  ALTER COLUMN is_active SET DEFAULT false;

-- 3) Keep auth trigger but stop auto-creating profile rows.
--    User rows are now provisioned from the User module (admin add flow).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
