-- 1) Fix existing queued campaign messages: attach the connected SDR session and reset retries
update public.send_queue sq
set session_id = '81e282e8-6233-4271-914a-a681132f8055',
    retry_count = 0,
    error_message = null,
    status = 'pending'
where sq.status = 'pending'
  and sq.account_id = 'fbb1ad4b-7d44-4994-842a-b091fc33dcf0'
  and sq.session_id is null;

-- Also link the conversations created by the campaign to the correct session
update public.conversations c
set session_id = '81e282e8-6233-4271-914a-a681132f8055'
where c.account_id = 'fbb1ad4b-7d44-4994-842a-b091fc33dcf0'
  and c.session_id is null
  and (c.metadata->>'outbound')::boolean = true;

-- 2) Create a cron job to process the send_queue every minute
select cron.schedule(
  'trigger-whatsapp-sender-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url:='https://ggrgqvnmuptwinxsobkz.supabase.co/functions/v1/trigger-whatsapp-sender',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncmdxdm5tdXB0d2lueHNvYmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODQ1MzgsImV4cCI6MjA4ODY2MDUzOH0.3oV3YSb4WsDGBKHi9YoZBQjuGe1kc2N3rOmPCCJ3uwI"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);