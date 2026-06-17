
CREATE TABLE IF NOT EXISTS public.wallet_reconciliation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  expected_balance numeric NOT NULL,
  previous_balance numeric NOT NULL,
  drift_amount numeric NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallet_reconciliation_log TO authenticated;
GRANT ALL ON public.wallet_reconciliation_log TO service_role;

ALTER TABLE public.wallet_reconciliation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reconciliation log"
ON public.wallet_reconciliation_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Mark stuck "initiated" transactions as failed after 10 minutes
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
        failure_reason = COALESCE(failure_reason, 'Auto-failed by reconciliation: stuck in initiated >10min'),
        api_response = COALESCE(api_response, '{}'::jsonb) || jsonb_build_object('reconciled_at', now())
    WHERE status = 'initiated'
      AND created_at < now() - interval '10 minutes'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN jsonb_build_object('stuck_transactions_failed', v_count);
END;
$$;

-- Recompute every wallet balance from the ledger and correct drift
CREATE OR REPLACE FUNCTION public.reconcile_all_wallets()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_credits numeric;
  v_debits numeric;
  v_expected numeric;
  v_drift numeric;
  v_fixed_count int := 0;
  v_checked int := 0;
BEGIN
  FOR r IN SELECT user_id, balance FROM wallets LOOP
    v_checked := v_checked + 1;

    SELECT COALESCE(SUM(amount), 0) INTO v_credits
    FROM wallet_transactions
    WHERE user_id = r.user_id AND type = 'credit' AND status = 'successful';

    SELECT COALESCE(SUM(amount), 0) INTO v_debits
    FROM wallet_transactions
    WHERE user_id = r.user_id AND type = 'debit' AND status = 'successful';

    v_expected := v_credits - v_debits;
    v_drift := v_expected - r.balance;

    IF v_drift <> 0 THEN
      UPDATE wallets SET balance = v_expected, updated_at = now()
      WHERE user_id = r.user_id;

      INSERT INTO wallet_reconciliation_log
        (user_id, expected_balance, previous_balance, drift_amount, action, details)
      VALUES
        (r.user_id, v_expected, r.balance, v_drift, 'auto_corrected',
         jsonb_build_object('credits', v_credits, 'debits', v_debits));

      v_fixed_count := v_fixed_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('wallets_checked', v_checked, 'wallets_corrected', v_fixed_count);
END;
$$;

-- Wrapper that runs both
CREATE OR REPLACE FUNCTION public.run_wallet_reconciliation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stuck jsonb;
  v_recon jsonb;
BEGIN
  v_stuck := reconcile_stuck_transactions();
  v_recon := reconcile_all_wallets();
  RETURN jsonb_build_object('ran_at', now(), 'stuck', v_stuck, 'reconciliation', v_recon);
END;
$$;
