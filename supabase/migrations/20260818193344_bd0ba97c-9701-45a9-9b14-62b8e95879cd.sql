CREATE OR REPLACE FUNCTION public.enforce_account_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec jsonb := to_jsonb(NEW);
  new_account uuid;
  conv_id uuid;
  sess_id uuid;
  conv_account uuid;
  sess_account uuid;
BEGIN
  IF rec ? 'account_id' AND rec->>'account_id' IS NOT NULL THEN
    new_account := (rec->>'account_id')::uuid;
  END IF;

  IF rec ? 'conversation_id' AND rec->>'conversation_id' IS NOT NULL THEN
    conv_id := (rec->>'conversation_id')::uuid;
    SELECT account_id INTO conv_account FROM public.conversations WHERE id = conv_id;
    IF conv_account IS NOT NULL AND new_account IS DISTINCT FROM conv_account THEN
      RAISE EXCEPTION 'account_id mismatch: % belongs to account %, got %', TG_TABLE_NAME, conv_account, new_account;
    END IF;
  END IF;

  IF rec ? 'session_id' AND rec->>'session_id' IS NOT NULL THEN
    sess_id := (rec->>'session_id')::uuid;
    SELECT account_id INTO sess_account FROM public.whatsapp_sessions WHERE id = sess_id;
    IF sess_account IS NOT NULL AND new_account IS DISTINCT FROM sess_account THEN
      RAISE EXCEPTION 'account_id mismatch: % session belongs to account %, got %', TG_TABLE_NAME, sess_account, new_account;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_account_consistency() FROM PUBLIC, anon, authenticated;