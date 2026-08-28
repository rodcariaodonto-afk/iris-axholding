-- 1) Configuração por conta
ALTER TABLE public.nina_settings
  ADD COLUMN IF NOT EXISTS human_takeover_timeout_hours integer NOT NULL DEFAULT 12;

-- 2) Auditoria de troca IA <-> humano
CREATE OR REPLACE FUNCTION public.audit_conversation_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_logs (
      account_id, actor_user_id, action, resource_type, resource_id,
      event_type, severity, entity_type, entity_id, old_values, new_values, metadata
    ) VALUES (
      NEW.account_id, auth.uid(), 'conversation.status_changed', 'conversation', NEW.id::text,
      'conversation.status_changed', 'info', 'conversation', NEW.id::text,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      jsonb_build_object('contact_id', NEW.contact_id, 'assigned_user_id', NEW.assigned_user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_conversation_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_conversation_status_change_trigger ON public.conversations;
CREATE TRIGGER audit_conversation_status_change_trigger
AFTER UPDATE OF status ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.audit_conversation_status_change();

-- 3) Retorno automático de conversas paradas em atendimento humano
CREATE OR REPLACE FUNCTION public.release_stale_human_conversations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released integer := 0;
BEGIN
  WITH cfg AS (
    SELECT account_id, human_takeover_timeout_hours AS hours
    FROM public.nina_settings
    WHERE human_takeover_timeout_hours > 0
  ),
  stale AS (
    SELECT c.id
    FROM public.conversations c
    JOIN cfg ON cfg.account_id = c.account_id
    WHERE c.status = 'human'
      AND c.last_message_at < now() - make_interval(hours => cfg.hours)
  )
  UPDATE public.conversations c
  SET status = 'nina', updated_at = now()
  FROM stale
  WHERE c.id = stale.id;

  GET DIAGNOSTICS released = ROW_COUNT;
  RETURN released;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_stale_human_conversations() FROM PUBLIC, anon, authenticated;