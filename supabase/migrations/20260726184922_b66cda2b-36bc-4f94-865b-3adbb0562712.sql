select cron.schedule(
  'receipt-queue-dispatch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--e49d619a-0076-4db9-9246-fc4d101474c2.lovable.app/api/public/cron/receipt-queue',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdXZ5d3N6ZGtxYWV0YnlyZnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MzcxNzgsImV4cCI6MjEwMDAxMzE3OH0.Bo-aXzNniUAdh24ProFFcpXxlrik-7Od0Q0tW23TTC0"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);