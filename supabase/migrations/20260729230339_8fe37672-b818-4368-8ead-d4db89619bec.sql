ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS team_members_account_email_key ON public.team_members (account_id, lower(email));