DO $$
DECLARE job record;
BEGIN
  FOR job IN SELECT jobid FROM cron.job WHERE jobname IN ('whatsapp-monthly-summary','whatsapp-daily-summary','whatsapp-weekly-summary','whatsapp-weekly-tip','whatsapp-inactivity') LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END $$;