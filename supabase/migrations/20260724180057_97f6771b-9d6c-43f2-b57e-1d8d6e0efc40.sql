
-- =========================================================
-- 1) DIRECTOR DAILY REPORTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.director_daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  revenue numeric NOT NULL DEFAULT 0,
  expenses numeric NOT NULL DEFAULT 0,
  profit numeric NOT NULL DEFAULT 0,
  new_leads integer NOT NULL DEFAULT 0,
  new_students integer NOT NULL DEFAULT 0,
  attendance_rate numeric NOT NULL DEFAULT 0,
  debtors_count integer NOT NULL DEFAULT 0,
  debtors_amount numeric NOT NULL DEFAULT 0,
  top_teachers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.director_daily_reports TO authenticated;
GRANT ALL ON public.director_daily_reports TO service_role;
ALTER TABLE public.director_daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "director_reports_read_staff"
  ON public.director_daily_reports FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'director'::public.app_role)
         OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_director_daily_reports_updated_at
  BEFORE UPDATE ON public.director_daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.director_report_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  telegram_chat_id text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (telegram_chat_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.director_report_recipients TO authenticated;
GRANT ALL ON public.director_report_recipients TO service_role;
ALTER TABLE public.director_report_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipients_director_all"
  ON public.director_report_recipients FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'director'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'director'::public.app_role));

CREATE TRIGGER trg_director_report_recipients_updated_at
  BEFORE UPDATE ON public.director_report_recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 2) SIP / IP TELEPHONY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sip_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'custom',
  sip_uri text,
  username text,
  auth_id text,
  caller_id text,
  webhook_secret text,
  api_base_url text,
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  singleton boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sip_config_singleton_unique UNIQUE (singleton)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sip_config TO authenticated;
GRANT ALL ON public.sip_config TO service_role;
ALTER TABLE public.sip_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sip_config_director_all"
  ON public.sip_config FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'director'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'director'::public.app_role));

CREATE TRIGGER trg_sip_config_updated_at
  BEFORE UPDATE ON public.sip_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.sip_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extension text NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (extension),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sip_extensions TO authenticated;
GRANT ALL ON public.sip_extensions TO service_role;
ALTER TABLE public.sip_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sip_ext_director_all"
  ON public.sip_extensions FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'director'::public.app_role)
         OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'director'::public.app_role)
              OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "sip_ext_owner_read"
  ON public.sip_extensions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_sip_extensions_updated_at
  BEFORE UPDATE ON public.sip_extensions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend calls table for SIP
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS sip_call_id text,
  ADD COLUMN IF NOT EXISTS trunk text,
  ADD COLUMN IF NOT EXISTS answered_at timestamptz,
  ADD COLUMN IF NOT EXISTS hangup_cause text,
  ADD COLUMN IF NOT EXISTS cost numeric,
  ADD COLUMN IF NOT EXISTS recording_storage_path text;

CREATE INDEX IF NOT EXISTS idx_calls_sip_call_id ON public.calls (sip_call_id);

-- =========================================================
-- 3) PARENT NOTIFICATIONS: dedup + triggers
-- =========================================================

-- Dedup key: student + kind + payload->>'ref_date' (for daily), or payload->>'ref_id' for row events
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_notifications_dedup
  ON public.parent_notifications (student_id, kind, (payload->>'ref_id'))
  WHERE payload ? 'ref_id';

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_notifications_daily_dedup
  ON public.parent_notifications (student_id, kind, (payload->>'ref_date'))
  WHERE payload ? 'ref_date';

CREATE INDEX IF NOT EXISTS idx_parent_notifications_pending
  ON public.parent_notifications (status, created_at)
  WHERE status = 'pending';

-- Trigger: payment -> parent notification
CREATE OR REPLACE FUNCTION public.parent_notify_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
BEGIN
  SELECT id, parent_telegram_chat_id, parent_notifications_enabled
    INTO s FROM public.students WHERE id = NEW.student_id;
  IF s.id IS NULL OR s.parent_telegram_chat_id IS NULL OR NOT s.parent_notifications_enabled THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    INSERT INTO public.parent_notifications (student_id, kind, channel, payload, status)
    VALUES (NEW.student_id, 'payment_paid', 'telegram',
            jsonb_build_object('ref_id', NEW.id::text, 'amount', NEW.amount, 'period_month', NEW.period_month),
            'pending')
    ON CONFLICT DO NOTHING;
  ELSIF NEW.status = 'pending' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.parent_notifications (student_id, kind, channel, payload, status)
    VALUES (NEW.student_id, 'payment_due', 'telegram',
            jsonb_build_object('ref_id', NEW.id::text, 'amount', NEW.amount, 'period_month', NEW.period_month, 'next_due_date', NEW.next_due_date),
            'pending')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_parent_notify_payment ON public.payments;
CREATE TRIGGER trg_parent_notify_payment
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.parent_notify_payment();

-- Trigger: grade -> parent notification
CREATE OR REPLACE FUNCTION public.parent_notify_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
BEGIN
  SELECT id, parent_telegram_chat_id, parent_notifications_enabled
    INTO s FROM public.students WHERE id = NEW.student_id;
  IF s.id IS NULL OR s.parent_telegram_chat_id IS NULL OR NOT s.parent_notifications_enabled THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.parent_notifications (student_id, kind, channel, payload, status)
  VALUES (NEW.student_id, 'grade', 'telegram',
          jsonb_build_object('ref_id', NEW.id::text, 'score', NEW.score, 'max_score', NEW.max_score, 'kind', NEW.kind, 'graded_at', NEW.graded_at),
          'pending')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_parent_notify_grade ON public.grades;
CREATE TRIGGER trg_parent_notify_grade
  AFTER INSERT ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.parent_notify_grade();

-- Trigger: behavior evaluation
CREATE OR REPLACE FUNCTION public.parent_notify_behavior()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
BEGIN
  SELECT id, parent_telegram_chat_id, parent_notifications_enabled
    INTO s FROM public.students WHERE id = NEW.student_id;
  IF s.id IS NULL OR s.parent_telegram_chat_id IS NULL OR NOT s.parent_notifications_enabled THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.parent_notifications (student_id, kind, channel, payload, status)
  VALUES (NEW.student_id, 'behavior', 'telegram',
          jsonb_build_object('ref_id', NEW.id::text, 'rating', NEW.rating, 'comment', NEW.comment, 'lesson_date', NEW.lesson_date),
          'pending')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_parent_notify_behavior ON public.behavior_evaluations;
CREATE TRIGGER trg_parent_notify_behavior
  AFTER INSERT ON public.behavior_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.parent_notify_behavior();

-- Trigger: attendance (only absent/late)
CREATE OR REPLACE FUNCTION public.parent_notify_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
BEGIN
  IF NEW.status NOT IN ('absent', 'late') THEN RETURN NEW; END IF;

  SELECT id, parent_telegram_chat_id, parent_notifications_enabled
    INTO s FROM public.students WHERE id = NEW.student_id;
  IF s.id IS NULL OR s.parent_telegram_chat_id IS NULL OR NOT s.parent_notifications_enabled THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.parent_notifications (student_id, kind, channel, payload, status)
  VALUES (NEW.student_id, 'attendance', 'telegram',
          jsonb_build_object('ref_id', NEW.id::text, 'status', NEW.status, 'date', NEW.date, 'note', NEW.note),
          'pending')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_parent_notify_attendance ON public.attendance;
CREATE TRIGGER trg_parent_notify_attendance
  AFTER INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.parent_notify_attendance();
