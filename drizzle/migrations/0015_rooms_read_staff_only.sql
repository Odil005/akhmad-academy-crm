DROP POLICY IF EXISTS rooms_read_auth ON public.rooms;
CREATE POLICY rooms_read_staff ON public.rooms FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'director'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'teacher'::app_role));