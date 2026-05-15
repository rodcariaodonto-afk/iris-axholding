CREATE OR REPLACE FUNCTION public.check_account_limit(_account_id uuid, _resource text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT
      (SELECT COUNT(*) FROM public.account_members WHERE account_id = _account_id AND status = 'active')
      +
      (SELECT COUNT(*) FROM public.account_invites
        WHERE account_id = _account_id
          AND accepted_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > now())
      INTO v_current;
    v_limit := v_plan_row.max_users;
  ELSIF _resource = 'contacts' THEN
    SELECT COUNT(*) INTO v_current FROM public.contacts WHERE account_id = _account_id;
    v_limit := v_plan_row.max_contacts;
  ELSIF _resource = 'messages_month' THEN
    SELECT COUNT(*) INTO v_current FROM public.messages WHERE account_id = _account_id AND created_at >= date_trunc('month', now());
    v_limit := v_plan_row.max_messages_month;
  ELSIF _resource = 'whatsapp_sessions' OR _resource = 'whatsapp_numbers' THEN
    SELECT COUNT(*) INTO v_current FROM public.whatsapp_sessions WHERE account_id = _account_id;
    v_limit := v_plan_row.max_whatsapp_numbers;
  ELSE
    RETURN jsonb_build_object('allowed', true);
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_current < v_limit,
    'current', v_current,
    'limit', v_limit,
    'plan', v_plan,
    'resource', _resource
  );
END;
$function$;