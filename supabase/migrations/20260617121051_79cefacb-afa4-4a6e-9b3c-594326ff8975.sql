
CREATE OR REPLACE FUNCTION public.reconcile_stuck_transactions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH updated AS (
    UPDATE service_transactions
    SET status = 'failed',
        api_response = COALESCE(api_response, '{}'::jsonb) || jsonb_build_object(
          'reconciled_at', now(),
          'reconciliation_reason', 'Auto-failed: stuck in initiated >10min'
        )
    WHERE status = 'initiated'
      AND created_at < now() - interval '10 minutes'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN jsonb_build_object('stuck_transactions_failed', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_transactions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stuck_transactions() TO service_role;
