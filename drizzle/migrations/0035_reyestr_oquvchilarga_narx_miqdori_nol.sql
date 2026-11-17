CREATE OR REPLACE FUNCTION public.enforce_low_income_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_low boolean;
BEGIN
  SELECT s.low_income INTO v_low FROM public.students s WHERE s.id = NEW.student_id;
  IF COALESCE(v_low, false) THEN
    NEW.monthly_fee := 0;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enrollments_low_income_fee ON public.student_enrollments;
CREATE TRIGGER trg_enrollments_low_income_fee
  BEFORE INSERT OR UPDATE ON public.student_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_low_income_fee();

CREATE OR REPLACE FUNCTION public.enforce_low_income_student_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF COALESCE(NEW.low_income, false) THEN
    NEW.monthly_fee := 0;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_students_low_income_fee ON public.students;
CREATE TRIGGER trg_students_low_income_fee
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_low_income_student_fee();

CREATE OR REPLACE FUNCTION public.apply_low_income_to_enrollments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.low_income AND NOT COALESCE(OLD.low_income, false) THEN
    UPDATE public.student_enrollments
       SET monthly_fee = 0
     WHERE student_id = NEW.id
       AND COALESCE(status, 'active') = 'active'
       AND COALESCE(monthly_fee, 0) <> 0;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_students_low_income_apply ON public.students;
CREATE TRIGGER trg_students_low_income_apply
  AFTER UPDATE OF low_income ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.apply_low_income_to_enrollments();