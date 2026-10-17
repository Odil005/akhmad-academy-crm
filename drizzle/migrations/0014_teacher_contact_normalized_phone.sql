CREATE OR REPLACE FUNCTION public.activate_teacher_contact(p_phone text,p_chat text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ids uuid[]; person public.profiles; existing_chat text;
BEGIN
 IF p_phone !~ '^[0-9]{9}$' OR p_chat !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Invalid contact'; END IF;
 SELECT array_agg(p.id) INTO ids FROM public.profiles p WHERE right(regexp_replace(coalesce(p.phone,''),'\D','','g'),9)=p_phone AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role='teacher');
 IF coalesce(cardinality(ids),0)=0 THEN RETURN jsonb_build_object('status','not_found'); END IF;
 IF cardinality(ids)<>1 THEN RETURN jsonb_build_object('status','ambiguous'); END IF;
 SELECT * INTO person FROM public.profiles WHERE id=ids[1] FOR UPDATE;
 SELECT telegram_chat_id INTO existing_chat FROM public.staff_telegram_links WHERE user_id=person.id;
 IF (existing_chat ~ '^[0-9]+$' AND existing_chat<>p_chat) OR (person.telegram_chat_id ~ '^[0-9]+$' AND person.telegram_chat_id<>p_chat) OR EXISTS(SELECT 1 FROM public.staff_telegram_links WHERE telegram_chat_id=p_chat AND user_id<>person.id) THEN RETURN jsonb_build_object('status','conflict'); END IF;
 INSERT INTO public.staff_telegram_links(user_id,role,full_name,telegram_chat_id,notifications_enabled) VALUES(person.id,'teacher',person.full_name,p_chat,true) ON CONFLICT(user_id) DO UPDATE SET telegram_chat_id=EXCLUDED.telegram_chat_id,role='teacher',full_name=EXCLUDED.full_name,notifications_enabled=true,updated_at=now();
 UPDATE public.profiles SET telegram_chat_id=p_chat,telegram_verified_at=now() WHERE id=person.id;
 RETURN jsonb_build_object('status','linked');
END $$;
REVOKE ALL ON FUNCTION public.activate_teacher_contact(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_teacher_contact(text,text) TO service_role;