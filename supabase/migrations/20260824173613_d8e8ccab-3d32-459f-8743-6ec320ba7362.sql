CREATE OR REPLACE FUNCTION public.validate_nina_business_hours()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.business_hours_start IS NOT NULL
     AND NEW.business_hours_end IS NOT NULL
     AND NEW.business_hours_start = NEW.business_hours_end THEN
    RAISE EXCEPTION 'O horário de fim do atendimento deve ser diferente do horário de início';
  END IF;

  IF NEW.business_days IS NULL OR array_length(NEW.business_days, 1) IS NULL THEN
    NEW.business_days := ARRAY[1,2,3,4,5];
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_nina_business_hours_trigger ON public.nina_settings;

CREATE TRIGGER validate_nina_business_hours_trigger
BEFORE INSERT OR UPDATE ON public.nina_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_nina_business_hours();