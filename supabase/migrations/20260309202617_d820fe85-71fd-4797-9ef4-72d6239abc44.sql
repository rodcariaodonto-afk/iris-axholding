
-- Fix function search_path for security
ALTER FUNCTION public.auto_create_deal_on_contact() SET search_path = public;
ALTER FUNCTION public.update_conversation_last_message() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
