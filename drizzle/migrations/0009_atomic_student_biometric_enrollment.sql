CREATE OR REPLACE FUNCTION public.save_student_biometric_enrollment(p_student_id uuid, p_image text, p_descriptors jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF NOT (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'director'::public.app_role)) THEN RAISE EXCEPTION 'Permission denied'; END IF;
 IF jsonb_typeof(p_descriptors) <> 'array' OR jsonb_array_length(p_descriptors) <> 3 THEN RAISE EXCEPTION 'Three facial samples required'; END IF;
 INSERT INTO public.student_face_enrollments(student_id,image_url,updated_at) VALUES(p_student_id,p_image,now()) ON CONFLICT(student_id) DO UPDATE SET image_url=EXCLUDED.image_url,updated_at=now();
 INSERT INTO public.student_face_templates(student_id,descriptors,consent_confirmed_by,model_version) VALUES(p_student_id,p_descriptors,auth.uid(),'face-api-1.7.15') ON CONFLICT(student_id) DO UPDATE SET descriptors=EXCLUDED.descriptors,consent_confirmed_by=auth.uid(),consent_confirmed_at=now(),updated_at=now(),model_version=EXCLUDED.model_version;
END $$;
REVOKE ALL ON FUNCTION public.save_student_biometric_enrollment(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_student_biometric_enrollment(uuid,text,jsonb) TO authenticated;