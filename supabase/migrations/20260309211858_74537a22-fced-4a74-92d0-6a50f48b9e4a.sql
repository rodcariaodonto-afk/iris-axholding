
-- Add Evolution API columns to nina_settings
ALTER TABLE public.nina_settings 
  ADD COLUMN IF NOT EXISTS whatsapp_provider text NOT NULL DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS evolution_api_url text,
  ADD COLUMN IF NOT EXISTS evolution_api_key text,
  ADD COLUMN IF NOT EXISTS evolution_instance_name text;
