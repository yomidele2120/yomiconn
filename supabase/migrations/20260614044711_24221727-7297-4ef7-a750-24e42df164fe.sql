
-- Revoke broad EXECUTE on SECURITY DEFINER helpers; grant only to needed roles.

-- Trigger-only functions: nobody needs direct EXECUTE
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_wallet() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Wallet money-movement helpers: only backend (service_role) should call directly
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_wallet_safe(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_wallet(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_wallet(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_wallet_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_wallet_safe(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_wallet(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_wallet(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_wallet_balance(uuid) TO service_role;

-- Fraud / rate-limit / api-key checks: backend only
REVOKE EXECUTE ON FUNCTION public.check_fraud(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_api_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_fraud(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_api_key(text) TO service_role;

-- Used in RLS policies & client checks for signed-in users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.has_transaction_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_transaction_pin(uuid) TO authenticated, service_role;
