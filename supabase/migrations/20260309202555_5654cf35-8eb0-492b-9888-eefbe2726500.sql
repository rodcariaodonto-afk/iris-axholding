
-- 2. Recreate triggers

-- Auto-create deal when contact is created
CREATE OR REPLACE FUNCTION public.auto_create_deal_on_contact()
RETURNS TRIGGER AS $$
DECLARE
  first_stage_id uuid;
BEGIN
  SELECT id INTO first_stage_id FROM public.pipeline_stages WHERE is_active = true ORDER BY position ASC LIMIT 1;
  
  IF first_stage_id IS NOT NULL THEN
    INSERT INTO public.deals (title, contact_id, stage_id, user_id)
    VALUES (
      COALESCE(NEW.name, NEW.phone_number),
      NEW.id,
      first_stage_id,
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_create_deal_on_contact ON public.contacts;
CREATE TRIGGER auto_create_deal_on_contact
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_deal_on_contact();

-- Update conversation last_message and contact last_activity on new message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations 
  SET last_message_at = NEW.sent_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  
  UPDATE public.contacts
  SET last_activity = NEW.sent_at, updated_at = now()
  WHERE id = (SELECT contact_id FROM public.conversations WHERE id = NEW.conversation_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON public.messages;
CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at ON public.contacts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.conversations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.conversation_states;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.conversation_states FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.nina_processing_queue;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.nina_processing_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.message_processing_queue;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.message_processing_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.send_queue;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.send_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.nina_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.nina_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.tag_definitions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tag_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
