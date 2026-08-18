UPDATE public.nina_settings
SET system_prompt_override = NULL,
    company_name = NULLIF(company_name, 'Viver de IA'),
    sdr_name = NULLIF(sdr_name, 'Nina')
WHERE account_id = '7b026d3e-06e9-4c69-9d93-629244a1a65b'
  AND system_prompt_override ILIKE '%Viver de IA%';