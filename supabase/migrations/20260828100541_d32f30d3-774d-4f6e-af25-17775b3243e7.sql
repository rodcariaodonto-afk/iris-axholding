-- 1) Descarta itens da fila da IA antigos (mais de 6h) que estavam represando o processamento
UPDATE public.nina_processing_queue
SET status = 'completed', processed_at = now(), error_message = 'expired_stale_backlog'
WHERE status = 'pending' AND created_at < now() - interval '6 hours';

-- 2) Corrige horário invertido da Pró Animais (19:00 -> 06:00) para horário comercial
UPDATE public.nina_settings
SET business_hours_start = '08:00', business_hours_end = '18:00', business_days = ARRAY[1,2,3,4,5]
WHERE account_id = '323bdfbf-a493-4b52-be4d-f7d7e25d1f65';

-- 3) Cron: orquestrador da IA a cada minuto + envio a cada minuto (todos os dias/horas)
SELECT cron.unschedule('trigger-whatsapp-sender-every-minute');
SELECT cron.schedule('trigger-whatsapp-sender-every-minute', '* * * * *', $$
  select net.http_post(
    url:='https://ggrgqvnmuptwinxsobkz.supabase.co/functions/v1/trigger-whatsapp-sender',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb
  );
$$);
SELECT cron.schedule('trigger-nina-orchestrator-every-minute', '* * * * *', $$
  select net.http_post(
    url:='https://ggrgqvnmuptwinxsobkz.supabase.co/functions/v1/trigger-nina-orchestrator',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{}'::jsonb
  );
$$);