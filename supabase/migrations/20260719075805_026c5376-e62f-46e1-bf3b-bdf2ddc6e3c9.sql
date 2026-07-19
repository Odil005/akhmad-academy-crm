
-- Enums
DO $$ BEGIN
  CREATE TYPE public.cash_account_type AS ENUM ('cash', 'card', 'bank', 'online', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tx_type AS ENUM ('income', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tx_source AS ENUM ('payment', 'marketplace', 'expense', 'salary', 'manual', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) cash_accounts
CREATE TABLE IF NOT EXISTS public.cash_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.cash_account_type NOT NULL DEFAULT 'cash',
  balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_accounts TO authenticated;
GRANT ALL ON public.cash_accounts TO service_role;
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_read_cash_accounts" ON public.cash_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "finance_insert_cash_accounts" ON public.cash_accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'director'));
CREATE POLICY "finance_update_cash_accounts" ON public.cash_accounts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'director')) WITH CHECK (public.has_role(auth.uid(), 'director'));
CREATE POLICY "finance_delete_cash_accounts" ON public.cash_accounts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'director'));

CREATE TRIGGER cash_accounts_updated_at BEFORE UPDATE ON public.cash_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  cash_account_id uuid REFERENCES public.cash_accounts(id) ON DELETE SET NULL,
  receipt_url text,
  recurring text NOT NULL DEFAULT 'one-time',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_read_expenses" ON public.expenses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "finance_insert_expenses" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "finance_update_expenses" ON public.expenses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'director')) WITH CHECK (public.has_role(auth.uid(), 'director'));
CREATE POLICY "finance_delete_expenses" ON public.expenses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'director'));

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_expenses_paid_at ON public.expenses(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

-- 3) transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.tx_type NOT NULL,
  source public.tx_source NOT NULL DEFAULT 'manual',
  category text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  cash_account_id uuid REFERENCES public.cash_accounts(id) ON DELETE SET NULL,
  description text,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_read_transactions" ON public.transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "finance_insert_transactions" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "finance_update_transactions" ON public.transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'director')) WITH CHECK (public.has_role(auth.uid(), 'director'));
CREATE POLICY "finance_delete_transactions" ON public.transactions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'director'));

CREATE INDEX IF NOT EXISTS idx_tx_occurred_at ON public.transactions(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_cash_account ON public.transactions(cash_account_id);
CREATE INDEX IF NOT EXISTS idx_tx_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_tx_category ON public.transactions(category);

-- 4) payments extensions
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS cash_account_id uuid REFERENCES public.cash_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS next_due_date date;

-- 5) cash balance recompute trigger
CREATE OR REPLACE FUNCTION public.tx_update_cash_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cash_account_id IS NULL THEN RETURN NEW; END IF;
    delta := CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END;
    UPDATE public.cash_accounts SET balance = balance + delta WHERE id = NEW.cash_account_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.cash_account_id IS NULL THEN RETURN OLD; END IF;
    delta := CASE WHEN OLD.type = 'income' THEN -OLD.amount ELSE OLD.amount END;
    UPDATE public.cash_accounts SET balance = balance + delta WHERE id = OLD.cash_account_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_tx_update_cash_balance ON public.transactions;
CREATE TRIGGER trg_tx_update_cash_balance
AFTER INSERT OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tx_update_cash_balance();

-- 6) Auto-create transaction from paid payment
CREATE OR REPLACE FUNCTION public.payment_to_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    INSERT INTO public.transactions (type, source, category, amount, cash_account_id, description, student_id, payment_id, occurred_at, created_by)
    VALUES ('income', 'payment', 'Ta''lim to''lovi', NEW.amount, NEW.cash_account_id,
            'To''lov #' || NEW.id::text, NEW.student_id, NEW.id, COALESCE(NEW.paid_at, now()), auth.uid());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_payment_to_transaction ON public.payments;
CREATE TRIGGER trg_payment_to_transaction
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.payment_to_transaction();

-- 7) Auto-create transaction from expense
CREATE OR REPLACE FUNCTION public.expense_to_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transactions (type, source, category, amount, cash_account_id, description, expense_id, occurred_at, created_by)
    VALUES ('expense', 'expense', NEW.category, NEW.amount, NEW.cash_account_id, NEW.description, NEW.id, NEW.paid_at::timestamptz, NEW.created_by);
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE expense_id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_expense_to_transaction ON public.expenses;
CREATE TRIGGER trg_expense_to_transaction
AFTER INSERT OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.expense_to_transaction();

-- 8) Seed default cash accounts if none
INSERT INTO public.cash_accounts (name, type)
SELECT * FROM (VALUES ('Naqd kassa', 'cash'::public.cash_account_type), ('Karta (Uzcard/Humo)', 'card'::public.cash_account_type), ('Bank o''tkazma', 'bank'::public.cash_account_type))
AS v(name, type)
WHERE NOT EXISTS (SELECT 1 FROM public.cash_accounts);
