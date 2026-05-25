
-- 1) Restrict nina_settings SELECT to owners/admins (contains API keys)
DROP POLICY IF EXISTS "Account members read nina_settings" ON public.nina_settings;
CREATE POLICY "Owners/admins read nina_settings"
ON public.nina_settings
FOR SELECT
TO authenticated
USING (
  has_account_role(account_id, ARRAY['owner'::app_account_role, 'admin'::app_account_role])
  OR is_super_admin()
);

-- 2) Restrict whatsapp_account_settings SELECT to owners/admins/managers
DROP POLICY IF EXISTS "Members read whatsapp_account_settings" ON public.whatsapp_account_settings;
CREATE POLICY "Owners/admins/managers read whatsapp_account_settings"
ON public.whatsapp_account_settings
FOR SELECT
TO authenticated
USING (
  has_account_role(account_id, ARRAY['owner'::app_account_role, 'admin'::app_account_role, 'manager'::app_account_role])
  OR is_super_admin()
);

-- 3) Restrict whatsapp_sessions SELECT to owners/admins/managers (contains access tokens)
DROP POLICY IF EXISTS "Members read whatsapp_sessions" ON public.whatsapp_sessions;
CREATE POLICY "Owners/admins/managers read whatsapp_sessions"
ON public.whatsapp_sessions
FOR SELECT
TO authenticated
USING (
  has_account_role(account_id, ARRAY['owner'::app_account_role, 'admin'::app_account_role, 'manager'::app_account_role])
  OR is_super_admin()
);

-- 4) Lock media-files storage INSERT/UPDATE/DELETE to members of the account
--    Path convention: {account_id}/{filename}
DROP POLICY IF EXISTS "Authenticated upload for media-files" ON storage.objects;

CREATE POLICY "Account members upload to media-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media-files'
  AND (
    public.is_account_member(((storage.foldername(name))[1])::uuid)
    OR public.is_super_admin()
  )
);

CREATE POLICY "Account members update media-files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media-files'
  AND (
    public.is_account_member(((storage.foldername(name))[1])::uuid)
    OR public.is_super_admin()
  )
);

CREATE POLICY "Account members delete media-files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'media-files'
  AND (
    public.is_account_member(((storage.foldername(name))[1])::uuid)
    OR public.is_super_admin()
  )
);
