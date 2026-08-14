-- Remove the historic pg_cron job that embedded a public API key and called a
-- hard-coded Lovable URL. Vercel cron now invokes protected production routes
-- with Authorization: Bearer <CRON_SECRET>.

DO $$
DECLARE
  job_record record;
BEGIN
  FOR job_record IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'receipt-queue-dispatch'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;
EXCEPTION
  WHEN undefined_table OR invalid_schema_name THEN
    NULL;
END;
$$;
