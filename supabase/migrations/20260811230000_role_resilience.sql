-- Keep at least one director account available. The UI and server functions
-- already prevent deleting a director, but this also protects direct API calls.
CREATE OR REPLACE FUNCTION public.prevent_last_director_role_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'director'::public.app_role
    AND (TG_OP = 'DELETE' OR NEW.role <> 'director'::public.app_role)
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles remaining
      WHERE remaining.role = 'director'::public.app_role
        AND remaining.id <> OLD.id
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Oxirgi direktor roli o''chirib yoki o''zgartirib bo''lmaydi.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_last_director_role_removal() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_last_director_role_removal ON public.user_roles;
CREATE TRIGGER trg_prevent_last_director_role_removal
BEFORE DELETE OR UPDATE OF role ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_director_role_removal();
