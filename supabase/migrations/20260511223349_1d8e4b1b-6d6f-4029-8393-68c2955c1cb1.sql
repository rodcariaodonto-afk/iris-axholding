ALTER TABLE public.nina_settings
  ADD COLUMN IF NOT EXISTS invite_from_email text,
  ADD COLUMN IF NOT EXISTS invite_from_name text,
  ADD COLUMN IF NOT EXISTS invite_email_provider text DEFAULT 'resend',
  ADD COLUMN IF NOT EXISTS invite_email_verified_at timestamp with time zone;