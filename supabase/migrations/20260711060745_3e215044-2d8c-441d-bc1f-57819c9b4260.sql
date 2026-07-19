
-- 1) Marketplace price integrity: recompute unit_price/total from products
CREATE OR REPLACE FUNCTION public.marketplace_order_enforce_price()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  authoritative_price numeric;
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity < 1 THEN
    NEW.quantity := 1;
  END IF;
  SELECT price INTO authoritative_price FROM public.marketplace_products WHERE id = NEW.product_id;
  IF authoritative_price IS NULL THEN
    RAISE EXCEPTION 'Invalid product_id';
  END IF;
  NEW.unit_price := authoritative_price;
  NEW.total := authoritative_price * NEW.quantity;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_order_enforce_price ON public.marketplace_orders;
CREATE TRIGGER trg_marketplace_order_enforce_price
BEFORE INSERT OR UPDATE ON public.marketplace_orders
FOR EACH ROW EXECUTE FUNCTION public.marketplace_order_enforce_price();

-- 2) Stop auto-assigning 'student' role to any new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  -- Roles are assigned explicitly by director/admin via createManagedUser.
  RETURN NEW;
END;
$$;

-- 3) Scrub plaintext access codes from credentials tables
UPDATE public.student_credentials SET access_code = '***';
UPDATE public.teacher_credentials SET access_code = '***';
UPDATE public.admin_credentials  SET access_code = '***';
UPDATE public.director_credentials SET access_code = '***';

-- 4) Tighten teacher_ui_settings read policy
DROP POLICY IF EXISTS "tus: authenticated read" ON public.teacher_ui_settings;
CREATE POLICY "tus: staff read" ON public.teacher_ui_settings
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);
