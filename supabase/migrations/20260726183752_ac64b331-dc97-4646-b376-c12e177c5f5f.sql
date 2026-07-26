-- 1. Extend payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS cashier_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS fiscal_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS fiscalized_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_uidx
  ON public.payments (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_fiscal_status_idx ON public.payments (fiscal_status);
CREATE INDEX IF NOT EXISTS payments_cashier_idx ON public.payments (cashier_id);

-- 2. fiscal_receipts
CREATE TABLE IF NOT EXISTS public.fiscal_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  provider_transaction_id text UNIQUE,
  receipt_number text,
  fiscal_sign text,
  fiscal_qr_data text,
  receipt_url text,
  cashbox_id text,
  cashier_name text,
  company_tin text,
  test_mode boolean NOT NULL DEFAULT true,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fiscal_receipts TO authenticated;
GRANT ALL ON public.fiscal_receipts TO service_role;
ALTER TABLE public.fiscal_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read fiscal receipts" ON public.fiscal_receipts
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'director') OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "student reads own fiscal receipt" ON public.fiscal_receipts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payments p
    JOIN public.student_credentials sc ON sc.student_id = p.student_id
    WHERE p.id = fiscal_receipts.payment_id AND sc.auth_user_id = auth.uid()
  ));

-- 3. notification_queue
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  recipient_type text NOT NULL DEFAULT 'parent',
  telegram_chat_id text,
  message_text text NOT NULL,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_queue TO authenticated;
GRANT ALL ON public.notification_queue TO service_role;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read notification queue" ON public.notification_queue
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'director') OR private.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS notification_queue_status_idx ON public.notification_queue (status);

-- 4. cash_register_settings
CREATE TABLE IF NOT EXISTS public.cash_register_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid UNIQUE,
  provider_name text NOT NULL DEFAULT 'mock',
  cashbox_id text,
  company_tin text,
  company_name text NOT NULL DEFAULT 'AKHMAD ACADEMY',
  branch_address text,
  vat_enabled boolean NOT NULL DEFAULT false,
  vat_percent numeric NOT NULL DEFAULT 12,
  enabled boolean NOT NULL DEFAULT false,
  test_mode boolean NOT NULL DEFAULT true,
  printer_type text NOT NULL DEFAULT 'browser_80mm',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cash_register_settings TO authenticated;
GRANT ALL ON public.cash_register_settings TO service_role;
ALTER TABLE public.cash_register_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read cash register settings" ON public.cash_register_settings
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'director') OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "director manages cash register settings" ON public.cash_register_settings
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'director'))
  WITH CHECK (private.has_role(auth.uid(), 'director'));

CREATE TRIGGER cash_register_settings_updated_at
  BEFORE UPDATE ON public.cash_register_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.cash_register_settings (branch_id, provider_name, company_name, enabled, test_mode)
SELECT NULL, 'mock', 'AKHMAD ACADEMY', false, true
WHERE NOT EXISTS (SELECT 1 FROM public.cash_register_settings);

-- 5. payment_audit_log
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_audit_log TO authenticated;
GRANT ALL ON public.payment_audit_log TO service_role;
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "director reads payment audit log" ON public.payment_audit_log
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'director'));

CREATE INDEX IF NOT EXISTS payment_audit_log_payment_idx ON public.payment_audit_log (payment_id);

-- 6. Payments policies: student self-read
CREATE POLICY "student reads own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_credentials sc
    WHERE sc.student_id = payments.student_id AND sc.auth_user_id = auth.uid()
  ));