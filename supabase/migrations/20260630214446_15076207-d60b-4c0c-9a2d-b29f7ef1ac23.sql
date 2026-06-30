
-- 1. Extend service_transactions
ALTER TABLE public.service_transactions
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;

-- Allow 'pending' status for async provider responses
ALTER TABLE public.service_transactions
  DROP CONSTRAINT IF EXISTS service_transactions_status_check;
ALTER TABLE public.service_transactions
  ADD CONSTRAINT service_transactions_status_check
  CHECK (status = ANY (ARRAY['initiated','pending','processing','successful','failed','refunded']));

-- 2. Webhook idempotency table
CREATE TABLE IF NOT EXISTS public.cheapdatahub_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  reference text,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cheapdatahub_webhook_events TO authenticated;
GRANT ALL ON public.cheapdatahub_webhook_events TO service_role;

ALTER TABLE public.cheapdatahub_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
ON public.cheapdatahub_webhook_events
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Settlement functions ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.settle_service_transaction_success(
  p_reference text,
  p_provider_reference text,
  p_api_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx        service_transactions%ROWTYPE;
  v_balance   numeric;
  v_debited   boolean;
BEGIN
  -- Lock the transaction row
  SELECT * INTO v_tx
  FROM service_transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF v_tx.id IS NULL THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  IF v_tx.status = 'successful' THEN
    RETURN jsonb_build_object('status','duplicate','message','already successful');
  END IF;

  IF v_tx.status = 'refunded' THEN
    RETURN jsonb_build_object('status','error','message','transaction was refunded');
  END IF;

  -- Has the wallet already been debited for this reference?
  SELECT EXISTS (
    SELECT 1 FROM wallet_transactions
    WHERE reference = p_reference
      AND type = 'debit'
      AND status = 'successful'
  ) INTO v_debited;

  IF NOT v_debited THEN
    SELECT balance INTO v_balance
    FROM wallets WHERE user_id = v_tx.user_id FOR UPDATE;

    IF v_balance IS NULL THEN
      RETURN jsonb_build_object('status','error','message','wallet not found');
    END IF;

    IF v_balance < v_tx.amount THEN
      -- Mark needs-attention: provider delivered but user has no funds
      UPDATE service_transactions
        SET status = 'successful',
            provider_reference = COALESCE(p_provider_reference, provider_reference),
            api_response = COALESCE(p_api_response, api_response),
            completed_at = now()
        WHERE id = v_tx.id;
      RETURN jsonb_build_object('status','no_debit','message','insufficient balance at settlement');
    END IF;

    UPDATE wallets
      SET balance = balance - v_tx.amount, updated_at = now()
      WHERE user_id = v_tx.user_id;

    INSERT INTO wallet_transactions (user_id, type, amount, reference, description, status)
    VALUES (v_tx.user_id, 'debit', v_tx.amount, p_reference,
            COALESCE('Service purchase: ' || v_tx.service_type, 'Service purchase'),
            'successful');
  END IF;

  UPDATE service_transactions
    SET status = 'successful',
        provider_reference = COALESCE(p_provider_reference, provider_reference),
        api_response = COALESCE(p_api_response, api_response),
        completed_at = now()
    WHERE id = v_tx.id;

  RETURN jsonb_build_object('status','success','reference',p_reference);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_service_transaction_success(text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_service_transaction_success(text,text,jsonb) TO service_role;


CREATE OR REPLACE FUNCTION public.settle_service_transaction_failure(
  p_reference text,
  p_reason text,
  p_api_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx service_transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_tx
  FROM service_transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF v_tx.id IS NULL THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  IF v_tx.status = 'successful' THEN
    RETURN jsonb_build_object('status','error','message','already successful, cannot fail');
  END IF;

  IF v_tx.status = 'failed' THEN
    RETURN jsonb_build_object('status','duplicate');
  END IF;

  UPDATE service_transactions
    SET status = 'failed',
        failure_reason = COALESCE(p_reason, failure_reason),
        api_response = COALESCE(p_api_response, api_response),
        completed_at = now()
    WHERE id = v_tx.id;

  RETURN jsonb_build_object('status','success');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_service_transaction_failure(text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_service_transaction_failure(text,text,jsonb) TO service_role;
