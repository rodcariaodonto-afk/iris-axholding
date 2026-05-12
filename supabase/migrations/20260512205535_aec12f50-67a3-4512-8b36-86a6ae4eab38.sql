
-- ============ EXTENSÕES ============
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.data_export_status AS ENUM ('pending','processing','completed','failed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.data_deletion_status AS ENUM ('pending','approved','scheduled','completed','cancelled','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dsar_status AS ENUM ('open','in_progress','resolved','rejected','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dsar_request_type AS ENUM ('access','rectification','portability','erasure','anonymization','consent_revocation','opposition');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.account_deletion_status AS ENUM ('none','pending','scheduled','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.consent_status AS ENUM ('granted','revoked','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.legal_basis AS ENUM ('consent','contract','legitimate_interest','legal_obligation','vital_interests','public_task');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.data_classification AS ENUM ('public','internal','confidential','restricted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_severity AS ENUM ('info','warn','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ EXTENSÕES EM TABELAS EXISTENTES ============
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS severity public.audit_severity NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS old_values jsonb,
  ADD COLUMN IF NOT EXISTS new_values jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_logs_account_created ON public.audit_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(account_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(account_id, event_type);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS retention_until timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_status public.account_deletion_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deletion_reason text;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS consent_status public.consent_status NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_basis public.legal_basis,
  ADD COLUMN IF NOT EXISTS privacy_notes text,
  ADD COLUMN IF NOT EXISTS data_origin text,
  ADD COLUMN IF NOT EXISTS data_classification public.data_classification NOT NULL DEFAULT 'internal';

CREATE INDEX IF NOT EXISTS idx_contacts_consent ON public.contacts(account_id, consent_status);
CREATE INDEX IF NOT EXISTS idx_contacts_legal_basis ON public.contacts(account_id, legal_basis);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS data_classification public.data_classification NOT NULL DEFAULT 'internal';

ALTER TABLE public.media_library
  ADD COLUMN IF NOT EXISTS data_classification public.data_classification NOT NULL DEFAULT 'internal';

-- ============ NOVAS TABELAS ============

-- data_exports
CREATE TABLE IF NOT EXISTS public.data_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  status public.data_export_status NOT NULL DEFAULT 'pending',
  format text NOT NULL DEFAULT 'json',
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  file_size bigint,
  download_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_data_exports_account ON public.data_exports(account_id, created_at DESC);
ALTER TABLE public.data_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins read data_exports" ON public.data_exports
  FOR SELECT TO authenticated
  USING (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin());

CREATE POLICY "Owners/admins insert data_exports" ON public.data_exports
  FOR INSERT TO authenticated
  WITH CHECK (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin());

CREATE POLICY "Service role full access data_exports" ON public.data_exports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- data_deletion_requests
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  request_type text NOT NULL DEFAULT 'account',
  status public.data_deletion_status NOT NULL DEFAULT 'pending',
  reason text,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deletion_account ON public.data_deletion_requests(account_id, status);
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read deletion_requests" ON public.data_deletion_requests
  FOR SELECT TO authenticated
  USING (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin());

CREATE POLICY "Owners insert deletion_requests" ON public.data_deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (has_account_role(account_id, ARRAY['owner']::app_account_role[]) OR is_super_admin());

CREATE POLICY "Owners update deletion_requests" ON public.data_deletion_requests
  FOR UPDATE TO authenticated
  USING (has_account_role(account_id, ARRAY['owner']::app_account_role[]) OR is_super_admin())
  WITH CHECK (has_account_role(account_id, ARRAY['owner']::app_account_role[]) OR is_super_admin());

CREATE POLICY "Service role full access deletion_requests" ON public.data_deletion_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- data_subject_requests
CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text,
  request_type public.dsar_request_type NOT NULL,
  related_contact_id uuid,
  status public.dsar_status NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  description text,
  assigned_to uuid,
  due_at timestamptz NOT NULL DEFAULT (now() + interval '15 days'),
  resolved_at timestamptz,
  resolution_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_dsar_account ON public.data_subject_requests(account_id, status, created_at DESC);
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins access dsar" ON public.data_subject_requests
  FOR ALL TO authenticated
  USING (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin())
  WITH CHECK (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin());

CREATE POLICY "Service role full access dsar" ON public.data_subject_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- account_policies
CREATE TABLE IF NOT EXISTS public.account_policies (
  account_id uuid PRIMARY KEY,
  retention_days_after_cancel int NOT NULL DEFAULT 30,
  audit_retention_days int NOT NULL DEFAULT 365,
  require_dsar_approval boolean NOT NULL DEFAULT true,
  default_legal_basis public.legal_basis,
  dpo_email text,
  privacy_policy_url text,
  terms_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.account_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read account_policies" ON public.account_policies
  FOR SELECT TO authenticated
  USING (is_account_member(account_id) OR is_super_admin());

CREATE POLICY "Owners/admins modify account_policies" ON public.account_policies
  FOR ALL TO authenticated
  USING (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin())
  WITH CHECK (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin());

-- governance_notifications
CREATE TABLE IF NOT EXISTS public.governance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid,
  type text NOT NULL,
  severity public.audit_severity NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gov_notif_account ON public.governance_notifications(account_id, created_at DESC);
ALTER TABLE public.governance_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/admins read notifications" ON public.governance_notifications
  FOR SELECT TO authenticated
  USING ((has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) AND (user_id IS NULL OR user_id = auth.uid())) OR is_super_admin());

CREATE POLICY "Owners/admins update notifications" ON public.governance_notifications
  FOR UPDATE TO authenticated
  USING (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin())
  WITH CHECK (has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR is_super_admin());

CREATE POLICY "Service role full access gov_notifications" ON public.governance_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- dsar_rate_limit
CREATE TABLE IF NOT EXISTS public.dsar_rate_limit (
  ip text PRIMARY KEY,
  count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dsar_rate_limit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only dsar_rate_limit" ON public.dsar_rate_limit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ FUNÇÕES E TRIGGERS ============

-- log_audit_v2 com novos campos
CREATE OR REPLACE FUNCTION public.log_audit_v2(
  _account_id uuid,
  _event_type text,
  _severity public.audit_severity,
  _entity_type text,
  _entity_id text DEFAULT NULL,
  _action text DEFAULT NULL,
  _old jsonb DEFAULT NULL,
  _new jsonb DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    account_id, actor_user_id, action, resource_type, resource_id,
    event_type, severity, entity_type, entity_id, old_values, new_values, metadata
  ) VALUES (
    _account_id, auth.uid(), COALESCE(_action, _event_type), COALESCE(_entity_type, 'unknown'), _entity_id,
    _event_type, _severity, _entity_type, _entity_id, _old, _new, COALESCE(_metadata, '{}'::jsonb)
  );
END;
$$;

-- Trigger: contacts consent changes
CREATE OR REPLACE FUNCTION public.trg_audit_contact_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.consent_status IS DISTINCT FROM OLD.consent_status)
     OR (NEW.legal_basis IS DISTINCT FROM OLD.legal_basis)
     OR (NEW.data_classification IS DISTINCT FROM OLD.data_classification) THEN
    INSERT INTO public.audit_logs (
      account_id, actor_user_id, action, resource_type, resource_id,
      event_type, severity, entity_type, entity_id, old_values, new_values
    ) VALUES (
      NEW.account_id, auth.uid(), 'contact.consent_changed', 'contact', NEW.id::text,
      'contact.consent_changed', 'warn', 'contact', NEW.id::text,
      jsonb_build_object('consent_status', OLD.consent_status, 'legal_basis', OLD.legal_basis, 'data_classification', OLD.data_classification),
      jsonb_build_object('consent_status', NEW.consent_status, 'legal_basis', NEW.legal_basis, 'data_classification', NEW.data_classification)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_contact_consent ON public.contacts;
CREATE TRIGGER trg_audit_contact_consent
  AFTER UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_contact_consent();

-- Trigger: account_policies changes (critical)
CREATE OR REPLACE FUNCTION public.trg_audit_account_policies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (
    account_id, actor_user_id, action, resource_type, resource_id,
    event_type, severity, entity_type, entity_id, old_values, new_values
  ) VALUES (
    COALESCE(NEW.account_id, OLD.account_id), auth.uid(),
    'policy.' || lower(TG_OP), 'account_policies', COALESCE(NEW.account_id, OLD.account_id)::text,
    'policy.' || lower(TG_OP), 'critical', 'account_policies', COALESCE(NEW.account_id, OLD.account_id)::text,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_account_policies ON public.account_policies;
CREATE TRIGGER trg_audit_account_policies
  AFTER INSERT OR UPDATE OR DELETE ON public.account_policies
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_account_policies();

-- updated_at trigger em account_policies
DROP TRIGGER IF EXISTS update_account_policies_updated_at ON public.account_policies;
CREATE TRIGGER update_account_policies_updated_at
  BEFORE UPDATE ON public.account_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CRON: account-purge diário ============
-- (Cron será criado via insert tool depois com URL/anon key)
