DO $$
DECLARE
  base text := 'https://project--e49d619a-0076-4db9-9246-fc4d101474c2.lovable.app/api/public/cron/';
  hdr text := $h$jsonb_build_object('Content-Type','application/json','x-cron-secret',(SELECT secret FROM private.cron_shared_secret LIMIT 1))$h$;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly_director_report') THEN
    PERFORM cron.unschedule('weekly_director_report');
  END IF;
  PERFORM cron.schedule('weekly_director_report', '0 16 * * 1',
    format('SELECT net.http_post(url := %L, headers := %s, body := ''{}''::jsonb, timeout_milliseconds := 60000) AS request_id;', base || 'weekly-report', hdr));
END $$;