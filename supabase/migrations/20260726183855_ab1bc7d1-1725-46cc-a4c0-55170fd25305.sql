CREATE OR REPLACE FUNCTION public.parent_notify_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD;
BEGIN
  -- Cashier/fiscal flow sends its own receipt message via notification_queue
  IF NEW.fiscal_status IS DISTINCT FROM 'draft' THEN
    RETURN NEW;
  END IF;

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
END; $function$;