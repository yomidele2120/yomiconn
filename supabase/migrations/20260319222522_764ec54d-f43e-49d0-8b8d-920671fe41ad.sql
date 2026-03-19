
-- Add unique constraint on wallet_transactions.reference to prevent duplicate credits
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_reference_unique 
ON public.wallet_transactions (reference) WHERE reference IS NOT NULL;

-- Add unique constraint on payment_sessions.reference
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_sessions_reference_unique 
ON public.payment_sessions (reference);

-- Add unique constraint on service_transactions.reference
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_transactions_reference_unique 
ON public.service_transactions (reference) WHERE reference IS NOT NULL;

-- Create a recalculate_wallet_balance function that computes balance from transactions
CREATE OR REPLACE FUNCTION public.recalculate_wallet_balance(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_credits numeric;
  v_debits numeric;
  v_balance numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_credits
  FROM wallet_transactions
  WHERE user_id = p_user_id AND type = 'credit' AND status = 'successful';

  SELECT COALESCE(SUM(amount), 0) INTO v_debits
  FROM wallet_transactions
  WHERE user_id = p_user_id AND type = 'debit' AND status = 'successful';

  v_balance := v_credits - v_debits;

  UPDATE wallets SET balance = v_balance, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_balance;
END;
$$;

-- Create improved credit_wallet that prevents double-crediting
CREATE OR REPLACE FUNCTION public.credit_wallet_safe(p_user_id uuid, p_amount numeric, p_reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Check if this reference already credited
  SELECT EXISTS(
    SELECT 1 FROM wallet_transactions 
    WHERE reference = p_reference AND type = 'credit' AND status = 'successful'
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('status', 'duplicate', 'message', 'Already credited');
  END IF;

  -- Credit atomically
  UPDATE wallets SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id;

  -- Record transaction
  INSERT INTO wallet_transactions (user_id, type, amount, reference, description, status)
  VALUES (p_user_id, 'credit', p_amount, p_reference, 'Wallet funded via Paystack', 'successful');

  RETURN jsonb_build_object('status', 'success');
END;
$$;
