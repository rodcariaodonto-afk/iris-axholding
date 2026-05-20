REVOKE EXECUTE ON FUNCTION public.create_deal_for_new_contact() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_deal_for_new_contact() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_deal_for_new_contact() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.auto_create_deal_on_contact() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_create_deal_on_contact() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_create_deal_on_contact() FROM authenticated;