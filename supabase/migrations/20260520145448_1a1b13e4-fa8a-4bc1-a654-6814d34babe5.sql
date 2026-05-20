CREATE OR REPLACE FUNCTION public.create_deal_for_new_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_stage_id uuid;
BEGIN
  SELECT id INTO first_stage_id
  FROM public.pipeline_stages
  WHERE is_active = true
    AND account_id = NEW.account_id
  ORDER BY position ASC
  LIMIT 1;

  IF first_stage_id IS NULL THEN
    RAISE NOTICE 'No active pipeline stages found for account %, skipping deal creation for contact %', NEW.account_id, NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.deals (
    contact_id,
    title,
    company,
    stage,
    stage_id,
    priority,
    user_id,
    owner_id,
    account_id
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.name, NEW.call_name, NEW.phone_number, 'Novo Lead'),
    NULL,
    'new',
    first_stage_id,
    'medium',
    NEW.user_id,
    NEW.user_id,
    NEW.account_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_create_deal_on_contact ON public.contacts;

CREATE TRIGGER auto_create_deal_on_contact
AFTER INSERT ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.create_deal_for_new_contact();

CREATE OR REPLACE FUNCTION public.auto_create_deal_on_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.create_deal_for_new_contact();
END;
$$;