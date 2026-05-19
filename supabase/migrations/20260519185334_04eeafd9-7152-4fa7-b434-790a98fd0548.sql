ALTER TABLE public.media_library
  ALTER COLUMN account_id SET DEFAULT public.current_account_id();

CREATE OR REPLACE FUNCTION public.ensure_media_library_account_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    NEW.account_id := public.current_account_id();
  END IF;

  IF NEW.account_id IS NULL THEN
    RAISE EXCEPTION 'Conta ativa não encontrada para salvar arquivo';
  END IF;

  IF NOT public.has_account_role(NEW.account_id, ARRAY['owner','admin','manager']::public.app_account_role[])
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão para salvar arquivo nesta conta';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_media_library_account_id_trigger ON public.media_library;
CREATE TRIGGER ensure_media_library_account_id_trigger
BEFORE INSERT ON public.media_library
FOR EACH ROW
EXECUTE FUNCTION public.ensure_media_library_account_id();