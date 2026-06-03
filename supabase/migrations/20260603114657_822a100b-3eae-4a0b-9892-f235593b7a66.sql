-- whatsapp_sessions: restrict to owner/admin only (remove manager access to raw tokens)
DROP POLICY IF EXISTS "Owners/admins/managers read whatsapp_sessions" ON public.whatsapp_sessions;
DROP POLICY IF EXISTS "Owners/admins/managers modify whatsapp_sessions" ON public.whatsapp_sessions;

CREATE POLICY "Owners/admins read whatsapp_sessions"
ON public.whatsapp_sessions
FOR SELECT
TO authenticated
USING (has_account_role(account_id, ARRAY['owner'::app_account_role, 'admin'::app_account_role]) OR is_super_admin());

CREATE POLICY "Owners/admins modify whatsapp_sessions"
ON public.whatsapp_sessions
FOR ALL
TO authenticated
USING (has_account_role(account_id, ARRAY['owner'::app_account_role, 'admin'::app_account_role]) OR is_super_admin())
WITH CHECK (has_account_role(account_id, ARRAY['owner'::app_account_role, 'admin'::app_account_role]) OR is_super_admin());

-- whatsapp_account_settings: restrict to owner/admin only
DROP POLICY IF EXISTS "Owners/admins/managers read whatsapp_account_settings" ON public.whatsapp_account_settings;
DROP POLICY IF EXISTS "Owners/admins/managers modify whatsapp_account_settings" ON public.whatsapp_account_settings;

CREATE POLICY "Owners/admins read whatsapp_account_settings"
ON public.whatsapp_account_settings
FOR SELECT
TO authenticated
USING (has_account_role(account_id, ARRAY['owner'::app_account_role, 'admin'::app_account_role]) OR is_super_admin());

CREATE POLICY "Owners/admins modify whatsapp_account_settings"
ON public.whatsapp_account_settings
FOR ALL
TO authenticated
USING (has_account_role(account_id, ARRAY['owner'::app_account_role, 'admin'::app_account_role]) OR is_super_admin())
WITH CHECK (has_account_role(account_id, ARRAY['owner'::app_account_role, 'admin'::app_account_role]) OR is_super_admin());