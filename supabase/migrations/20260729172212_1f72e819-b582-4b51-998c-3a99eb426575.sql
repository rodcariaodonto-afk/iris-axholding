UPDATE public.nina_settings
SET
  evolution_api_url = NULL,
  evolution_api_key = NULL,
  evolution_instance_name = NULL,
  updated_at = now()
WHERE evolution_api_url IS NOT NULL
  AND evolution_api_url !~* '^https?://';

UPDATE public.whatsapp_account_settings
SET
  evolution_api_url = NULL,
  evolution_api_key = NULL,
  updated_at = now()
WHERE evolution_api_url IS NOT NULL
  AND evolution_api_url !~* '^https?://';

ALTER TABLE public.nina_settings
  DROP CONSTRAINT IF EXISTS nina_settings_evolution_api_url_http_check;

ALTER TABLE public.nina_settings
  ADD CONSTRAINT nina_settings_evolution_api_url_http_check
  CHECK (evolution_api_url IS NULL OR evolution_api_url ~* '^https?://');

ALTER TABLE public.whatsapp_account_settings
  DROP CONSTRAINT IF EXISTS whatsapp_account_settings_evolution_api_url_http_check;

ALTER TABLE public.whatsapp_account_settings
  ADD CONSTRAINT whatsapp_account_settings_evolution_api_url_http_check
  CHECK (evolution_api_url IS NULL OR evolution_api_url ~* '^https?://');