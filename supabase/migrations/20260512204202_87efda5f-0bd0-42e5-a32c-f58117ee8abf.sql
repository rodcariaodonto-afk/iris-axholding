
-- Phase 3: Plans, Audit Logs, Super-Admin, Retention

-- 1. account_plans (plan catalog)
CREATE TABLE IF NOT EXISTS public.account_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  max_users int NOT NULL DEFAULT 5,
  max_contacts int NOT NULL DEFAULT 1000,
  max_messages_month int NOT NULL DEFAULT 5000,
  max_whatsapp_numbers int NOT NULL DEFAULT 1,
  ai_responses_month int NOT NULL DEFAULT 2000,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_monthly numeric NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read plans" ON public.account_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage plans" ON public.account_plans FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

INSERT INTO public.account_plans (code, name, description, max_users, max_contacts, max_messages_month, max_whatsapp_numbers, ai_responses_month, price_monthly, position, features) VALUES
  ('starter', 'Starter', 'Para começar', 3, 500, 2000, 1, 1000, 0, 1, '{"audit_logs": false, "custom_branding": false}'::jsonb),
  ('pro', 'Pro', 'Para times pequenos', 10, 5000, 20000, 2, 10000, 297, 2, '{"audit_logs": true, "custom_branding": false}'::jsonb),
  ('business', 'Business', 'Para empresas', 30, 25000, 100000, 5, 50000, 997, 3, '{"audit_logs": true, "custom_branding": true}'::jsonb),
  ('enterprise', 'Enterprise', 'Sob medida', 999, 999999, 999999, 99, 999999, 0, 4, '{"audit_logs": true, "custom_branding": true, "sla": true}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- 2. audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  impersonated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account ON public.audit_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account owners/admins read audit_logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_account_role(account_id, ARRAY['owner','admin']::app_account_role[]) OR public.is_super_admin());
CREATE POLICY "Service role writes audit_logs" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. log_audit helper
CREATE OR REPLACE FUNCTION public.log_audit(
  _account_id uuid,
  _action text,
  _resource_type text,
  _resource_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (account_id, actor_user_id, action, resource_type, resource_id, metadata)
  VALUES (_account_id, auth.uid(), _action, _resource_type, _resource_id, COALESCE(_metadata, '{}'::jsonb));
END;
$$;

-- 4. Audit triggers
CREATE OR REPLACE FUNCTION public.trg_audit_account_members() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_logs (account_id, actor_user_id, action, resource_type, resource_id, metadata)
    VALUES (NEW.account_id, auth.uid(), 'member.added', 'account_member', NEW.id::text, jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.role <> OLD.role OR NEW.status <> OLD.status THEN
      INSERT INTO public.audit_logs (account_id, actor_user_id, action, resource_type, resource_id, metadata)
      VALUES (NEW.account_id, auth.uid(), 'member.updated', 'account_member', NEW.id::text,
        jsonb_build_object('user_id', NEW.user_id, 'old_role', OLD.role, 'new_role', NEW.role, 'old_status', OLD.status, 'new_status', NEW.status));
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_logs (account_id, actor_user_id, action, resource_type, resource_id, metadata)
    VALUES (OLD.account_id, auth.uid(), 'member.removed', 'account_member', OLD.id::text, jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_account_members ON public.account_members;
CREATE TRIGGER audit_account_members AFTER INSERT OR UPDATE OR DELETE ON public.account_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_account_members();

CREATE OR REPLACE FUNCTION public.trg_audit_accounts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name <> OLD.name OR NEW.plan <> OLD.plan OR NEW.status <> OLD.status OR COALESCE(NEW.logo_url,'') <> COALESCE(OLD.logo_url,'') THEN
    INSERT INTO public.audit_logs (account_id, actor_user_id, action, resource_type, resource_id, metadata)
    VALUES (NEW.id, auth.uid(), 'account.updated', 'account', NEW.id::text,
      jsonb_build_object('old_name', OLD.name, 'new_name', NEW.name, 'old_plan', OLD.plan, 'new_plan', NEW.plan, 'old_status', OLD.status, 'new_status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_accounts ON public.accounts;
CREATE TRIGGER audit_accounts AFTER UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.trg_audit_accounts();

-- 5. check_account_limit
CREATE OR REPLACE FUNCTION public.check_account_limit(_account_id uuid, _resource text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit int;
  v_current int;
  v_plan_row public.account_plans%ROWTYPE;
BEGIN
  SELECT plan INTO v_plan FROM public.accounts WHERE id = _account_id;
  IF v_plan IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'account_not_found'); END IF;
  SELECT * INTO v_plan_row FROM public.account_plans WHERE code = v_plan::text;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', true); END IF;

  IF _resource = 'users' THEN
    SELECT COUNT(*) INTO v_current FROM public.account_members WHERE account_id = _account_id AND status = 'active';
    v_limit := v_plan_row.max_users;
  ELSIF _resource = 'contacts' THEN
    SELECT COUNT(*) INTO v_current FROM public.contacts WHERE account_id = _account_id;
    v_limit := v_plan_row.max_contacts;
  ELSIF _resource = 'messages_month' THEN
    SELECT COUNT(*) INTO v_current FROM public.messages WHERE account_id = _account_id AND created_at >= date_trunc('month', now());
    v_limit := v_plan_row.max_messages_month;
  ELSE
    RETURN jsonb_build_object('allowed', true);
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_current < v_limit,
    'current', v_current,
    'limit', v_limit,
    'plan', v_plan
  );
END;
$$;

-- 6. Storage bucket for exports
INSERT INTO storage.buckets (id, name, public) VALUES ('account-exports', 'account-exports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Account owners read exports" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'account-exports' AND public.has_account_role(((storage.foldername(name))[1])::uuid, ARRAY['owner','admin']::app_account_role[]));
