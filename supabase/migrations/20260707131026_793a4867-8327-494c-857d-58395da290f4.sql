ALTER TABLE public.outbound_campaigns
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS template_language text NOT NULL DEFAULT 'pt_BR';

UPDATE public.outbound_campaigns
  SET template_name = 'sofia_mensagem1', template_language = 'pt_BR'
  WHERE name ILIKE '%Recupera%Leads Frios%';