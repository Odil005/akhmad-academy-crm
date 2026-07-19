
-- Restrict EXECUTE on SECURITY DEFINER functions to only the roles that need them.
-- Trigger functions are invoked by the trigger system and do not need EXECUTE grants to API roles.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.marketplace_order_enforce_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settings_guard_is_public() FROM PUBLIC, anon, authenticated;

-- has_role is used by RLS policies for authenticated users; anon has no roles, so it never needs to call it.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
