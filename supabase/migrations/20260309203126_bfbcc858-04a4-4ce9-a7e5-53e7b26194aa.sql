
-- Re-create all triggers (they were lost during remix)

-- Auto-create deal on contact
DROP TRIGGER IF EXISTS auto_create_deal_on_contact ON public.contacts;
CREATE TRIGGER auto_create_deal_on_contact
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_deal_on_contact();

-- Update conversation last message
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON public.messages;
CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

-- Updated_at triggers
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
