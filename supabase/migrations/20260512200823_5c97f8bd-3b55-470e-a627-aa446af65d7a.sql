
-- ============================================================================
-- FASE 1: FUNDAÇÃO MULTI-TENANT
-- ============================================================================

-- 1. ENUMS
CREATE TYPE public.app_account_role AS ENUM ('owner', 'admin', 'manager', 'sdr', 'viewer');
CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'cancelled', 'pending');
CREATE TYPE public.account_plan AS ENUM ('starter', 'pro', 'business', 'enterprise');
CREATE TYPE public.account_member_status AS ENUM ('invited', 'active', 'disabled');

-- 2. ACCOUNTS
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  domain text,
  status public.account_status NOT NULL DEFAULT 'active',
  plan public.account_plan NOT NULL DEFAULT 'starter',
  is_internal boolean NOT NULL DEFAULT false,
  logo_url text,
  subscription_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  cancelled_at timestamptz,
  delete_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_status ON public.accounts(status);
CREATE INDEX idx_accounts_is_internal ON public.accounts(is_internal) WHERE is_internal = true;

-- 3. ACCOUNT_MEMBERS
CREATE TABLE public.account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_account_role NOT NULL DEFAULT 'sdr',
  status public.account_member_status NOT NULL DEFAULT 'active',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  invited_by uuid,
  invited_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id)
);

CREATE INDEX idx_account_members_user ON public.account_members(user_id) WHERE status = 'active';
CREATE INDEX idx_account_members_account ON public.account_members(account_id) WHERE status = 'active';

-- 4. ACCOUNT_INVITES
CREATE TABLE public.account_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_account_role NOT NULL DEFAULT 'sdr',
  token text NOT NULL UNIQUE,
  invited_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_invites_token ON public.account_invites(token);
CREATE INDEX idx_account_invites_account ON public.account_invites(account_id);

-- 5. SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.is_account_member(_account_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = _account_id
      AND user_id = auth.uid()
      AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.account_member_role(_account_id uuid)
RETURNS public.app_account_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.account_members
  WHERE account_id = _account_id AND user_id = auth.uid() AND status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_account_role(_account_id uuid, _roles public.app_account_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = _account_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members m
    JOIN public.accounts a ON a.id = m.account_id
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
      AND a.is_internal = true
  )
$$;

-- Returns the active account for the current request.
-- Reads from session GUC 'app.active_account' (set by frontend via RPC),
-- falls back to the first active membership.
CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_setting text;
  v_account uuid;
BEGIN
  BEGIN
    v_setting := current_setting('app.active_account', true);
  EXCEPTION WHEN OTHERS THEN
    v_setting := NULL;
  END;

  IF v_setting IS NOT NULL AND v_setting <> '' THEN
    BEGIN
      v_account := v_setting::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_account := NULL;
    END;

    IF v_account IS NOT NULL AND public.is_account_member(v_account) THEN
      RETURN v_account;
    END IF;
  END IF;

  SELECT account_id INTO v_account
  FROM public.account_members
  WHERE user_id = auth.uid() AND status = 'active'
  ORDER BY joined_at ASC
  LIMIT 1;

  RETURN v_account;
END;
$$;

-- RPC for frontend to set active account
CREATE OR REPLACE FUNCTION public.set_active_account(_account_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_account_member(_account_id) THEN
    RAISE EXCEPTION 'Not a member of this account';
  END IF;
  PERFORM set_config('app.active_account', _account_id::text, false);
END;
$$;

-- 6. CREATE AXHOLDING INTERNAL ACCOUNT
INSERT INTO public.accounts (name, slug, status, plan, is_internal, settings)
VALUES (
  'AXHolding Internal',
  'axholding',
  'active',
  'enterprise',
  true,
  '{"description": "Conta interna AXHolding (super-admins)"}'::jsonb
);

-- 7. MIGRATE EXISTING USERS AS MEMBERS OF AXHOLDING
DO $$
DECLARE
  v_account_id uuid;
BEGIN
  SELECT id INTO v_account_id FROM public.accounts WHERE slug = 'axholding';

  -- Admins → owner
  INSERT INTO public.account_members (account_id, user_id, role, status, joined_at)
  SELECT v_account_id, ur.user_id, 'owner'::public.app_account_role, 'active'::public.account_member_status, now()
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  ON CONFLICT (account_id, user_id) DO NOTHING;

  -- All other auth users → sdr
  INSERT INTO public.account_members (account_id, user_id, role, status, joined_at)
  SELECT v_account_id, u.id, 'sdr'::public.app_account_role, 'active'::public.account_member_status, now()
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.account_members m
    WHERE m.account_id = v_account_id AND m.user_id = u.id
  )
  ON CONFLICT (account_id, user_id) DO NOTHING;
END $$;

-- 8. ADD account_id TO OPERATIONAL TABLES
ALTER TABLE public.contacts ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.deals ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.deal_activities ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.pipeline_stages ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.teams ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.team_members ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.team_functions ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.tag_definitions ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.media_library ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.nina_settings ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.google_calendar_connections ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_states ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.send_queue ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.nina_processing_queue ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.message_processing_queue ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE public.message_grouping_queue ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;

-- 9. BACKFILL account_id WITH AXHOLDING ID
DO $$
DECLARE v_account_id uuid;
BEGIN
  SELECT id INTO v_account_id FROM public.accounts WHERE slug = 'axholding';

  UPDATE public.contacts SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.conversations SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.messages SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.appointments SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.deals SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.deal_activities SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.pipeline_stages SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.teams SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.team_members SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.team_functions SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.tag_definitions SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.media_library SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.nina_settings SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.google_calendar_connections SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.conversation_states SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.send_queue SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.nina_processing_queue SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.message_processing_queue SET account_id = v_account_id WHERE account_id IS NULL;
  UPDATE public.message_grouping_queue SET account_id = v_account_id WHERE account_id IS NULL;
END $$;

-- 10. SET account_id NOT NULL
ALTER TABLE public.contacts ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.deals ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.deal_activities ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.pipeline_stages ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.teams ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.team_members ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.team_functions ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.tag_definitions ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.media_library ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.nina_settings ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.google_calendar_connections ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.conversation_states ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.send_queue ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.nina_processing_queue ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.message_processing_queue ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.message_grouping_queue ALTER COLUMN account_id SET NOT NULL;

-- 11. INDEXES FOR account_id
CREATE INDEX idx_contacts_account ON public.contacts(account_id);
CREATE INDEX idx_conversations_account ON public.conversations(account_id);
CREATE INDEX idx_messages_account ON public.messages(account_id);
CREATE INDEX idx_appointments_account ON public.appointments(account_id);
CREATE INDEX idx_deals_account ON public.deals(account_id);
CREATE INDEX idx_pipeline_stages_account ON public.pipeline_stages(account_id);
CREATE INDEX idx_teams_account ON public.teams(account_id);
CREATE INDEX idx_team_members_account ON public.team_members(account_id);
CREATE INDEX idx_media_library_account ON public.media_library(account_id);
CREATE INDEX idx_nina_settings_account ON public.nina_settings(account_id);

-- 12. ENABLE RLS ON NEW TABLES
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invites ENABLE ROW LEVEL SECURITY;

-- 13. RLS POLICIES — accounts
CREATE POLICY "Members can view their accounts" ON public.accounts
  FOR SELECT TO authenticated
  USING (public.is_account_member(id) OR public.is_super_admin());

CREATE POLICY "Owners and admins can update account" ON public.accounts
  FOR UPDATE TO authenticated
  USING (public.has_account_role(id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin());

CREATE POLICY "Super admins can insert accounts" ON public.accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can delete accounts" ON public.accounts
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- 14. RLS POLICIES — account_members
CREATE POLICY "Members can view fellow members" ON public.account_members
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());

CREATE POLICY "Owners/admins manage members" ON public.account_members
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin());

-- 15. RLS POLICIES — account_invites
CREATE POLICY "Owners/admins manage invites" ON public.account_invites
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin());

-- 16. REPLACE OLD RLS POLICIES ON OPERATIONAL TABLES
-- Generic helper macro pattern: drop existing 'Authenticated users can access all X' and create account-scoped

-- contacts
DROP POLICY IF EXISTS "Authenticated users can access all contacts" ON public.contacts;
CREATE POLICY "Account members access contacts" ON public.contacts
  FOR ALL TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin())
  WITH CHECK (public.is_account_member(account_id) OR public.is_super_admin());

-- conversations
DROP POLICY IF EXISTS "Authenticated users can access all conversations" ON public.conversations;
CREATE POLICY "Account members access conversations" ON public.conversations
  FOR ALL TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin())
  WITH CHECK (public.is_account_member(account_id) OR public.is_super_admin());

-- messages
DROP POLICY IF EXISTS "Authenticated users can access all messages" ON public.messages;
CREATE POLICY "Account members access messages" ON public.messages
  FOR ALL TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin())
  WITH CHECK (public.is_account_member(account_id) OR public.is_super_admin());

-- appointments
DROP POLICY IF EXISTS "Authenticated users can access all appointments" ON public.appointments;
CREATE POLICY "Account members access appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin())
  WITH CHECK (public.is_account_member(account_id) OR public.is_super_admin());

-- deals
DROP POLICY IF EXISTS "Authenticated users can access all deals" ON public.deals;
CREATE POLICY "Account members access deals" ON public.deals
  FOR ALL TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin())
  WITH CHECK (public.is_account_member(account_id) OR public.is_super_admin());

-- deal_activities
DROP POLICY IF EXISTS "Users can access activities of their deals" ON public.deal_activities;
CREATE POLICY "Account members access deal_activities" ON public.deal_activities
  FOR ALL TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin())
  WITH CHECK (public.is_account_member(account_id) OR public.is_super_admin());

-- pipeline_stages
DROP POLICY IF EXISTS "Admins can modify pipeline_stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Authenticated can read pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Account members read pipeline_stages" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());
CREATE POLICY "Account admins modify pipeline_stages" ON public.pipeline_stages
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin','manager']::public.app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin','manager']::public.app_account_role[]) OR public.is_super_admin());

-- teams
DROP POLICY IF EXISTS "Admins can modify teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated can read teams" ON public.teams;
CREATE POLICY "Account members read teams" ON public.teams
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());
CREATE POLICY "Account admins modify teams" ON public.teams
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin());

-- team_members
DROP POLICY IF EXISTS "Admins can modify team_members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated can read team_members" ON public.team_members;
CREATE POLICY "Account members read team_members" ON public.team_members
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());
CREATE POLICY "Account admins modify team_members" ON public.team_members
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin());

-- team_functions
DROP POLICY IF EXISTS "Admins can modify team_functions" ON public.team_functions;
DROP POLICY IF EXISTS "Authenticated can read team_functions" ON public.team_functions;
CREATE POLICY "Account members read team_functions" ON public.team_functions
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());
CREATE POLICY "Account admins modify team_functions" ON public.team_functions
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin());

-- tag_definitions
DROP POLICY IF EXISTS "Admins can modify tag_definitions" ON public.tag_definitions;
DROP POLICY IF EXISTS "Authenticated can read tag_definitions" ON public.tag_definitions;
CREATE POLICY "Account members read tag_definitions" ON public.tag_definitions
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());
CREATE POLICY "Account admins modify tag_definitions" ON public.tag_definitions
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin','manager']::public.app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin','manager']::public.app_account_role[]) OR public.is_super_admin());

-- media_library
DROP POLICY IF EXISTS "Admins can manage media_library" ON public.media_library;
DROP POLICY IF EXISTS "Authenticated can read media_library" ON public.media_library;
CREATE POLICY "Account members read media_library" ON public.media_library
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());
CREATE POLICY "Account admins manage media_library" ON public.media_library
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin','manager']::public.app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin','manager']::public.app_account_role[]) OR public.is_super_admin());

-- nina_settings
DROP POLICY IF EXISTS "Admins can modify nina_settings" ON public.nina_settings;
DROP POLICY IF EXISTS "Authenticated can read nina_settings" ON public.nina_settings;
CREATE POLICY "Account members read nina_settings" ON public.nina_settings
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());
CREATE POLICY "Account admins modify nina_settings" ON public.nina_settings
  FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin']::public.app_account_role[]) OR public.is_super_admin());

-- google_calendar_connections (per-user but scoped by account too)
DROP POLICY IF EXISTS "Users can manage own google calendar connections" ON public.google_calendar_connections;
CREATE POLICY "Users manage own calendar in their account" ON public.google_calendar_connections
  FOR ALL TO authenticated
  USING ((user_id = auth.uid() AND public.is_account_member(account_id)) OR public.is_super_admin())
  WITH CHECK ((user_id = auth.uid() AND public.is_account_member(account_id)) OR public.is_super_admin());

-- conversation_states
DROP POLICY IF EXISTS "Users can access states of their conversations" ON public.conversation_states;
CREATE POLICY "Account members access conversation_states" ON public.conversation_states
  FOR ALL TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin())
  WITH CHECK (public.is_account_member(account_id) OR public.is_super_admin());

-- Queue tables: keep open for service-role, but tighten so authenticated only sees own account
DROP POLICY IF EXISTS "Allow all operations on send_queue" ON public.send_queue;
CREATE POLICY "Account members access send_queue" ON public.send_queue
  FOR ALL TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin())
  WITH CHECK (public.is_account_member(account_id) OR public.is_super_admin());
CREATE POLICY "Service role full access send_queue" ON public.send_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on nina_processing_queue" ON public.nina_processing_queue;
CREATE POLICY "Account members access nina_processing_queue" ON public.nina_processing_queue
  FOR ALL TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin())
  WITH CHECK (public.is_account_member(account_id) OR public.is_super_admin());
CREATE POLICY "Service role full access nina_processing_queue" ON public.nina_processing_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on message_processing_queue" ON public.message_processing_queue;
CREATE POLICY "Account members access message_processing_queue" ON public.message_processing_queue
  FOR ALL TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin())
  WITH CHECK (public.is_account_member(account_id) OR public.is_super_admin());
CREATE POLICY "Service role full access message_processing_queue" ON public.message_processing_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on message_grouping_queue" ON public.message_grouping_queue;
CREATE POLICY "Account members access message_grouping_queue" ON public.message_grouping_queue
  FOR ALL TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin())
  WITH CHECK (public.is_account_member(account_id) OR public.is_super_admin());
CREATE POLICY "Service role full access message_grouping_queue" ON public.message_grouping_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 17. UPDATE handle_new_user TRIGGER: also add new signup as 'sdr' member of AXHolding (transitional compat)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_axholding_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT DO NOTHING;

  -- Legacy user_roles compat
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  -- Auto-add new signups to AXHolding as sdr (transitional; Fase 2 invite flow will replace this)
  SELECT id INTO v_axholding_id FROM public.accounts WHERE slug = 'axholding';
  IF v_axholding_id IS NOT NULL THEN
    INSERT INTO public.account_members (account_id, user_id, role, status)
    VALUES (v_axholding_id, NEW.id, 'sdr', 'active')
    ON CONFLICT (account_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 18. UPDATED_AT TRIGGERS for new tables
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_account_members_updated_at BEFORE UPDATE ON public.account_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 19. Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_members;
