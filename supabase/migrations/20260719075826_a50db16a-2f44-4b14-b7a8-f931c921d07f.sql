
REVOKE EXECUTE ON FUNCTION public.tx_update_cash_balance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.payment_to_transaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expense_to_transaction() FROM PUBLIC, anon, authenticated;
