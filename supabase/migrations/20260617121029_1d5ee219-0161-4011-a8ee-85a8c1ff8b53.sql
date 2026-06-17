
REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_transactions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_all_wallets() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_wallet_reconciliation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stuck_transactions() TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_all_wallets() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_wallet_reconciliation() TO service_role;
