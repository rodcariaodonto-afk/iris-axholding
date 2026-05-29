DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 2) THEN
    PERFORM cron.alter_job(job_id := 2, schedule := '30 seconds');
  END IF;
END $$;