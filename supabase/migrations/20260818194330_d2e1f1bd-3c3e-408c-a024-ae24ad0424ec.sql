DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'evolution-session-monitor-every-5-minutes';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'evolution-session-monitor-every-5-minutes',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ggrgqvnmuptwinxsobkz.supabase.co/functions/v1/evolution-session-monitor',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncmdxdm5tdXB0d2lueHNvYmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODQ1MzgsImV4cCI6MjA4ODY2MDUzOH0.3oV3YSb4WsDGBKHi9YoZBQjuGe1kc2N3rOmPCCJ3uwI","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncmdxdm5tdXB0d2lueHNvYmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODQ1MzgsImV4cCI6MjA4ODY2MDUzOH0.3oV3YSb4WsDGBKHi9YoZBQjuGe1kc2N3rOmPCCJ3uwI"}'::jsonb,
    body := jsonb_build_object('scheduled_at', now())
  );
  $cron$
);