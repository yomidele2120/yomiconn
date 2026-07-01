-- Refund settlement: credit wallet once, mark transaction refunded
CREATE OR REPLACE FUNCTION public.settle_service_transaction_refund(
  p_reference text,
  p_reason text,
  p_api_response jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx service_transactions%ROWTYPE;
  v_debited boolean;
  v_already_refunded boolean;
BEGIN
  SELECT * INTO v_tx FROM service_transactions
    WHERE reference = p_reference FOR UPDATE;

  IF v_tx.id IS NULL THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  -- idempotency: refund credit already booked?
  SELECT EXISTS (
    SELECT 1 FROM wallet_transactions
    WHERE reference = p_reference AND type = 'credit'
      AND description ILIKE 'Refund%' AND status = 'successful'
  ) INTO v_already_refunded;

  IF v_already_refunded THEN
    RETURN jsonb_build_object('status','duplicate','message','already refunded');
  END IF;

  -- Only credit back if we had actually debited
  SELECT EXISTS (
    SELECT 1 FROM wallet_transactions
    WHERE reference = p_reference AND type = 'debit' AND status = 'successful'
  ) INTO v_debited;

  IF v_debited THEN
    UPDATE wallets SET balance = balance + v_tx.amount, updated_at = now()
      WHERE user_id = v_tx.user_id;

    INSERT INTO wallet_transactions (user_id, type, amount, reference, description, status)
    VALUES (v_tx.user_id, 'credit', v_tx.amount, p_reference,
            'Refund: ' || COALESCE(v_tx.service_type,'service'), 'successful');
  END IF;

  UPDATE service_transactions
    SET status = 'refunded',
        failure_reason = COALESCE(p_reason, failure_reason),
        api_response = COALESCE(p_api_response, api_response),
        completed_at = now()
    WHERE id = v_tx.id;

  RETURN jsonb_build_object('status','success','credited', v_debited);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_service_transaction_refund(text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_service_transaction_refund(text,text,jsonb) TO service_role;