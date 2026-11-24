DO $$
DECLARE r record; q text; w text; stmt text;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname='public' LOOP
    q := r.qual; w := r.with_check;
    IF q IS NOT NULL THEN
      q := replace(q, 'auth.uid()', '(SELECT auth.uid())');
      q := regexp_replace(q, 'private\.has_role\(\(SELECT auth\.uid\(\)\), ''(\w+)''::app_role\)', '(SELECT private.has_role((SELECT auth.uid()), ''\1''::app_role))', 'g');
      q := replace(q, 'private.current_center()', '(SELECT private.current_center())');
      q := replace(q, 'private.is_platform_owner()', '(SELECT private.is_platform_owner())');
    END IF;
    IF w IS NOT NULL THEN
      w := replace(w, 'auth.uid()', '(SELECT auth.uid())');
      w := regexp_replace(w, 'private\.has_role\(\(SELECT auth\.uid\(\)\), ''(\w+)''::app_role\)', '(SELECT private.has_role((SELECT auth.uid()), ''\1''::app_role))', 'g');
      w := replace(w, 'private.current_center()', '(SELECT private.current_center())');
      w := replace(w, 'private.is_platform_owner()', '(SELECT private.is_platform_owner())');
    END IF;
    IF q IS DISTINCT FROM r.qual OR w IS DISTINCT FROM r.with_check THEN
      stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
      IF q IS NOT NULL THEN stmt := stmt || ' USING (' || q || ')'; END IF;
      IF w IS NOT NULL THEN stmt := stmt || ' WITH CHECK (' || w || ')'; END IF;
      EXECUTE stmt;
    END IF;
  END LOOP;
END $$;