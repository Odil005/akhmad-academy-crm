CREATE OR REPLACE FUNCTION private.current_center(_user_id uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT center_id FROM public.user_centers WHERE user_id = _user_id ORDER BY created_at LIMIT 1),
    '84596da8-b5db-42ba-8908-8fcbeb450928'::uuid
  );
$function$;