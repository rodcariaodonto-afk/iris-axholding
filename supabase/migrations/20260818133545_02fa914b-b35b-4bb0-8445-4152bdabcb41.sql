CREATE OR REPLACE FUNCTION public.enforce_account_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_account uuid;
  sess_account uuid;
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    SELECT account_id INTO conv_account FROM public.conversations WHERE id = NEW.conversation_id;
    IF conv_account IS NOT NULL AND NEW.account_id IS DISTINCT FROM conv_account THEN
      RAISE EXCEPTION 'account_id mismatch: % belongs to account %, got %', TG_TABLE_NAME, conv_account, NEW.account_id;
    END IF;
  END IF;

  IF NEW.session_id IS NOT NULL THEN
    SELECT account_id INTO sess_account FROM public.whatsapp_sessions WHERE id = NEW.session_id;
    IF sess_account IS NOT NULL AND NEW.account_id IS DISTINCT FROM sess_account THEN
      RAISE EXCEPTION 'account_id mismatch: % session belongs to account %, got %', TG_TABLE_NAME, sess_account, NEW.account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_account_consistency_messages ON public.messages;
CREATE TRIGGER enforce_account_consistency_messages
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_account_consistency();

DROP TRIGGER IF EXISTS enforce_account_consistency_send_queue ON public.send_queue;
CREATE TRIGGER enforce_account_consistency_send_queue
BEFORE INSERT OR UPDATE ON public.send_queue
FOR EACH ROW EXECUTE FUNCTION public.enforce_account_consistency();

DROP TRIGGER IF EXISTS enforce_account_consistency_nina_queue ON public.nina_processing_queue;
CREATE TRIGGER enforce_account_consistency_nina_queue
BEFORE INSERT OR UPDATE ON public.nina_processing_queue
FOR EACH ROW EXECUTE FUNCTION public.enforce_account_consistency();

DROP TRIGGER IF EXISTS enforce_account_consistency_conversations ON public.conversations;
CREATE TRIGGER enforce_account_consistency_conversations
BEFORE INSERT OR UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.enforce_account_consistency();