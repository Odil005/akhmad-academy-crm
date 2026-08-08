DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'akhmad.director@edunest.local';

  IF uid IS NULL THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'akhmad.director@edunest.local',
      extensions.crypt('Akhmad#2026Crm', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Akhmad Director"}'::jsonb
    );
    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
    VALUES (gen_random_uuid(), uid, uid::text, 'email',
      json_build_object('sub', uid::text, 'email', 'akhmad.director@edunest.local', 'email_verified', true)::jsonb,
      now(), now(), now());
  ELSE
    UPDATE auth.users
       SET encrypted_password = extensions.crypt('Akhmad#2026Crm', extensions.gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = uid;
  END IF;

  INSERT INTO public.profiles (id, full_name)
  VALUES (uid, 'Akhmad Director')
  ON CONFLICT (id) DO UPDATE SET full_name = 'Akhmad Director';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, 'director')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;