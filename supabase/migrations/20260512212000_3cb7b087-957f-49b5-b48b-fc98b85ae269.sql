
-- Enums
DO $$ BEGIN
  CREATE TYPE public.whatsapp_provider AS ENUM ('evolution', 'meta_cloud');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.whatsapp_session_status AS ENUM ('disconnected','qr_pending','connecting','connected','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- whatsapp_account_settings (1 por conta)
CREATE TABLE IF NOT EXISTS public.whatsapp_account_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE,
  evolution_api_url text,
  evolution_api_key text,
  max_sessions int NOT NULL DEFAULT 3,
  auto_reply_enabled boolean NOT NULL DEFAULT false,
  auto_reply_message text,
  webhook_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_account_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read whatsapp_account_settings"
  ON public.whatsapp_account_settings FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());

CREATE POLICY "Owners/admins/managers modify whatsapp_account_settings"
  ON public.whatsapp_account_settings FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin','manager']::app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin','manager']::app_account_role[]) OR public.is_super_admin());

CREATE TRIGGER trg_was_updated_at BEFORE UPDATE ON public.whatsapp_account_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- whatsapp_sessions (N por conta)
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  provider public.whatsapp_provider NOT NULL,
  session_name text NOT NULL,
  status public.whatsapp_session_status NOT NULL DEFAULT 'disconnected',
  phone_number text,
  qr_code text,
  last_connected_at timestamptz,
  error_message text,
  is_default boolean NOT NULL DEFAULT false,
  -- Evolution
  evolution_instance_name text,
  evolution_instance_id text,
  -- Meta Cloud
  whatsapp_phone_number_id text,
  whatsapp_business_account_id text,
  whatsapp_access_token text,
  whatsapp_verify_token text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_account ON public.whatsapp_sessions(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_sessions_default_per_account
  ON public.whatsapp_sessions(account_id) WHERE is_default = true;

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read whatsapp_sessions"
  ON public.whatsapp_sessions FOR SELECT TO authenticated
  USING (public.is_account_member(account_id) OR public.is_super_admin());

CREATE POLICY "Owners/admins/managers modify whatsapp_sessions"
  ON public.whatsapp_sessions FOR ALL TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin','manager']::app_account_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_account_role(account_id, ARRAY['owner','admin','manager']::app_account_role[]) OR public.is_super_admin());

CREATE POLICY "Service role full access whatsapp_sessions"
  ON public.whatsapp_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ws_updated_at BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger para sessions
CREATE OR REPLACE FUNCTION public.trg_audit_whatsapp_sessions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (
    account_id, actor_user_id, action, resource_type, resource_id,
    event_type, severity, entity_type, entity_id, old_values, new_values
  ) VALUES (
    COALESCE(NEW.account_id, OLD.account_id), auth.uid(),
    'whatsapp_session.' || lower(TG_OP),
    'whatsapp_session', COALESCE(NEW.id, OLD.id)::text,
    'whatsapp_session.' || lower(TG_OP), 'info',
    'whatsapp_session', COALESCE(NEW.id, OLD.id)::text,
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE jsonb_build_object('session_name', OLD.session_name, 'provider', OLD.provider, 'status', OLD.status, 'phone_number', OLD.phone_number) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE jsonb_build_object('session_name', NEW.session_name, 'provider', NEW.provider, 'status', NEW.status, 'phone_number', NEW.phone_number) END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_audit_whatsapp_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_sessions
FOR EACH ROW EXECUTE FUNCTION public.trg_audit_whatsapp_sessions();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_sessions;

-- Backfill: criar settings + sessão padrão a partir de nina_settings existentes
INSERT INTO public.whatsapp_account_settings (account_id, evolution_api_url, evolution_api_key)
SELECT account_id, evolution_api_url, evolution_api_key
FROM public.nina_settings
WHERE account_id IS NOT NULL
ON CONFLICT (account_id) DO NOTHING;

-- Sessão padrão Evolution para contas com instance configurada
INSERT INTO public.whatsapp_sessions (
  account_id, provider, session_name, status, evolution_instance_name, is_default
)
SELECT
  ns.account_id, 'evolution'::whatsapp_provider,
  COALESCE(ns.evolution_instance_name, 'Principal'),
  'disconnected'::whatsapp_session_status,
  ns.evolution_instance_name, true
FROM public.nina_settings ns
WHERE ns.account_id IS NOT NULL
  AND ns.evolution_instance_name IS NOT NULL
  AND ns.evolution_instance_name <> ''
  AND COALESCE(ns.whatsapp_provider, 'evolution') = 'evolution'
  AND NOT EXISTS (SELECT 1 FROM public.whatsapp_sessions ws WHERE ws.account_id = ns.account_id);

-- Sessão padrão Meta Cloud para contas com Meta configurado
INSERT INTO public.whatsapp_sessions (
  account_id, provider, session_name, status,
  whatsapp_phone_number_id, whatsapp_business_account_id,
  whatsapp_access_token, whatsapp_verify_token, is_default
)
SELECT
  ns.account_id, 'meta_cloud'::whatsapp_provider,
  'Meta Cloud Principal',
  'disconnected'::whatsapp_session_status,
  ns.whatsapp_phone_number_id, ns.whatsapp_business_account_id,
  ns.whatsapp_access_token, ns.whatsapp_verify_token, true
FROM public.nina_settings ns
WHERE ns.account_id IS NOT NULL
  AND ns.whatsapp_phone_number_id IS NOT NULL
  AND ns.whatsapp_phone_number_id <> ''
  AND ns.whatsapp_provider = 'meta_cloud'
  AND NOT EXISTS (SELECT 1 FROM public.whatsapp_sessions ws WHERE ws.account_id = ns.account_id);
