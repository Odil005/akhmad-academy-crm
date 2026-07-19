
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.marketplace_order_enforce_price() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.settings_guard_is_public() FROM authenticated;
