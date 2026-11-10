CREATE TABLE IF NOT EXISTS private.cron_shared_secret (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.cron_shared_secret FROM PUBLIC, anon, authenticated;
INSERT INTO private.cron_shared_secret (id, secret)
VALUES (true, encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT coalesce(length(p_secret), 0) >= 32 AND EXISTS (
    SELECT 1 FROM private.cron_shared_secret WHERE secret = p_secret
  );
$$;
REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;

DO $$
DECLARE
  base text := 'https://project--e49d619a-0076-4db9-9246-fc4d101474c2.lovable.app/api/public/cron/';
  job record;
  hdr text := $h$jsonb_build_object('Content-Type','application/json','x-cron-secret',(SELECT secret FROM private.cron_shared_secret LIMIT 1))$h$;
BEGIN
  FOR job IN SELECT jobname FROM cron.job WHERE jobname IN ('daily_director_report','daily_parent_digest','receipt-queue-dispatch') LOOP
    PERFORM cron.unschedule(job.jobname);
  END LOOP;

  PERFORM cron.schedule('daily_director_report', '0 16 * * *',
    format('SELECT net.http_post(url := %L, headers := %s, body := ''{}''::jsonb) AS request_id;', base || 'daily-report', hdr));
  PERFORM cron.schedule('daily_parent_digest', '0 15 * * *',
    format('SELECT net.http_post(url := %L, headers := %s, body := ''{}''::jsonb) AS request_id;', base || 'parent-digest', hdr));
END $$;