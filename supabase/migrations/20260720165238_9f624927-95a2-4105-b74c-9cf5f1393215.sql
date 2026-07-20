
-- 1. Create a private schema not exposed by the Data API
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- 2. Recreate has_role inside private
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

-- 3. Rebuild every policy that references public.has_role(...) so it points to private.has_role(...)
DO $$
DECLARE
  r RECORD;
  cmd_text text;
  roles_text text;
  qual_text text;
  wcheck_text text;
  using_clause text;
  wcheck_clause text;
  for_clause text;
BEGIN
  FOR r IN
    SELECT pol.polname,
           cls.relname,
           pol.polcmd,
           pol.polroles,
           pol.polrelid,
           pg_get_expr(pol.polqual, pol.polrelid) AS qual_src,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS wcheck_src
    FROM pg_policy pol
    JOIN pg_class cls ON cls.oid = pol.polrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public'
      AND (
        pg_get_expr(pol.polqual, pol.polrelid) LIKE '%has_role(%'
        OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%has_role(%'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.polname, r.relname);

    cmd_text := CASE r.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END;

    IF 0 = ANY(r.polroles) THEN
      roles_text := 'PUBLIC';
    ELSE
      SELECT string_agg(quote_ident(rolname), ', ')
      INTO roles_text
      FROM pg_roles
      WHERE oid = ANY(r.polroles);
    END IF;

    qual_text := replace(r.qual_src, 'has_role(', 'private.has_role(');
    wcheck_text := replace(r.wcheck_src, 'has_role(', 'private.has_role(');

    using_clause := CASE WHEN qual_text IS NOT NULL THEN ' USING (' || qual_text || ')' ELSE '' END;
    wcheck_clause := CASE WHEN wcheck_text IS NOT NULL THEN ' WITH CHECK (' || wcheck_text || ')' ELSE '' END;
    for_clause := ' FOR ' || cmd_text;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I%s TO %s%s%s',
      r.polname, r.relname, for_clause, roles_text, using_clause, wcheck_clause
    );
  END LOOP;
END $$;

-- 4. Rebuild the settings_guard_is_public trigger function to also use private.has_role
CREATE OR REPLACE FUNCTION public.settings_guard_is_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.is_public IS DISTINCT FROM OLD.is_public)
     OR (TG_OP = 'INSERT' AND NEW.is_public = true) THEN
    IF NOT private.has_role(auth.uid(), 'director'::public.app_role) THEN
      RAISE EXCEPTION 'Only director can change public visibility of settings';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Drop the public has_role now that nothing references it
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
