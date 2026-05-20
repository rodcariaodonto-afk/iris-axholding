CREATE OR REPLACE FUNCTION public.auto_create_deal_on_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  first_stage_id uuid;
BEGIN
  SELECT id INTO first_stage_id
  FROM public.pipeline_stages
  WHERE is_active = true AND (account_id = NEW.account_id OR account_id IS NULL)
  ORDER BY position ASC
  LIMIT 1;

  IF first_stage_id IS NOT NULL THEN
    INSERT INTO public.deals (title, contact_id, stage_id, user_id, account_id)
    VALUES (
      COALESCE(NEW.name, NEW.phone_number),
      NEW.id,
      first_stage_id,
      NEW.user_id,
      NEW.account_id
    );
  END IF;

  RETURN NEW;
END;
$function$;