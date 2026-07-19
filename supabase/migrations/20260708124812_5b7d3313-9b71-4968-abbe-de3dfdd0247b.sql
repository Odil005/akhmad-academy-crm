DROP POLICY "anyone can insert leads" ON public.leads;
CREATE POLICY "anyone can insert leads"
ON public.leads FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(name)) BETWEEN 2 AND 120
  AND length(btrim(phone)) BETWEEN 6 AND 40
  AND (course IS NULL OR length(course) <= 200)
  AND (note IS NULL OR length(note) <= 2000)
  AND status = 'new'
  AND (source IS NULL OR source = 'website')
);