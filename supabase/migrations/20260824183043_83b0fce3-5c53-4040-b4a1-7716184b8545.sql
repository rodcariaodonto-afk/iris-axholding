CREATE OR REPLACE FUNCTION public.cancel_ai_work_on_takeover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'nina' AND NEW.status IN ('human', 'paused') THEN
      UPDATE public.send_queue
         SET status = 'failed',
             error_message = 'conversation_taken_over',
             updated_at = now()
       WHERE conversation_id = NEW.id
         AND from_type = 'nina'
         AND status IN ('pending', 'processing');

      UPDATE public.nina_processing_queue
         SET status = 'failed',
             error_message = 'conversation_taken_over',
             processed_at = now(),
             updated_at = now()
       WHERE conversation_id = NEW.id
         AND status IN ('pending', 'processing');
    END IF;

    INSERT INTO public.audit_logs (
      account_id, actor_user_id, action, resource_type, resource_id,
      event_type, severity, entity_type, entity_id, old_values, new_values, metadata
    ) VALUES (
      NEW.account_id, auth.uid(), 'conversation.status_changed', 'conversation', NEW.id::text,
      'conversation.status_changed', 'info', 'conversation', NEW.id::text,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      jsonb_build_object('assigned_user_id', NEW.assigned_user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cancel_ai_work_on_takeover_trigger ON public.conversations;
CREATE TRIGGER cancel_ai_work_on_takeover_trigger
AFTER UPDATE OF status ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.cancel_ai_work_on_takeover();