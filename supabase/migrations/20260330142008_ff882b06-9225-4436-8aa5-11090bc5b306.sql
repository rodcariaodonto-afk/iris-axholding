
DROP TRIGGER IF EXISTS auto_create_deal_on_contact ON public.contacts;
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON public.messages;
DROP TRIGGER IF EXISTS set_contacts_updated_at ON public.contacts;
DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
DROP TRIGGER IF EXISTS set_conversation_states_updated_at ON public.conversation_states;
DROP TRIGGER IF EXISTS set_nina_settings_updated_at ON public.nina_settings;
DROP TRIGGER IF EXISTS set_tag_definitions_updated_at ON public.tag_definitions;
DROP TRIGGER IF EXISTS set_nina_processing_queue_updated_at ON public.nina_processing_queue;
DROP TRIGGER IF EXISTS set_message_processing_queue_updated_at ON public.message_processing_queue;
DROP TRIGGER IF EXISTS set_send_queue_updated_at ON public.send_queue;

CREATE TRIGGER auto_create_deal_on_contact
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deal_for_new_contact();

CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_conversation_states_updated_at
  BEFORE UPDATE ON public.conversation_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_nina_settings_updated_at
  BEFORE UPDATE ON public.nina_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_tag_definitions_updated_at
  BEFORE UPDATE ON public.tag_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_nina_processing_queue_updated_at
  BEFORE UPDATE ON public.nina_processing_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_message_processing_queue_updated_at
  BEFORE UPDATE ON public.message_processing_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_send_queue_updated_at
  BEFORE UPDATE ON public.send_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
