
-- Add frozen flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS frozen_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

-- Atomic wallet deduction function (SELECT FOR UPDATE to prevent race conditions)
CREATE OR REPLACE FUNCTION public.deduct_wallet(p_user_id uuid, p_amount numeric, p_reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric;
  v_result jsonb;
BEGIN
  -- Check idempotency: if reference already exists, return existing transaction
  IF EXISTS (SELECT 1 FROM service_transactions WHERE reference = p_reference) THEN
    SELECT jsonb_build_object('status', 'duplicate', 'message', 'Transaction already exists')
    INTO v_result;
    RETURN v_result;
  END IF;

  -- Lock the wallet row and get current balance
  SELECT balance INTO v_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Wallet not found');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Insufficient wallet balance');
  END IF;

  -- Deduct atomically
  UPDATE wallets SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_user_id;

  -- Record wallet transaction
  INSERT INTO wallet_transactions (user_id, type, amount, reference, description, status)
  VALUES (p_user_id, 'debit', p_amount, p_reference, 'Service purchase', 'successful');

  RETURN jsonb_build_object('status', 'success', 'new_balance', v_balance - p_amount);
END;
$$;

-- Credit wallet function (atomic)
CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE wallets SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Refund wallet function
CREATE OR REPLACE FUNCTION public.refund_wallet(p_user_id uuid, p_amount numeric, p_reference text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE wallets SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id;

  UPDATE wallet_transactions SET status = 'refunded'
  WHERE reference = p_reference;
END;
$$;

-- Rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON public.rate_limits(user_id, action, created_at);

-- Fraud events table
CREATE TABLE IF NOT EXISTS public.fraud_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  description text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fraud_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view fraud events" ON public.fraud_events
  FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update fraud events" ON public.fraud_events
  FOR UPDATE TO public USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id uuid, p_action text, p_max_count int, p_window_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM rate_limits
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;

  IF v_count >= p_max_count THEN
    RETURN false;
  END IF;

  INSERT INTO rate_limits (user_id, action) VALUES (p_user_id, p_action);
  RETURN true;
END;
$$;

-- Fraud detection function: check for rapid purchases
CREATE OR REPLACE FUNCTION public.check_fraud(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_purchase_count int;
  v_frozen boolean;
BEGIN
  -- Check if account is frozen
  SELECT is_frozen INTO v_frozen FROM profiles WHERE user_id = p_user_id;
  IF v_frozen THEN
    RETURN jsonb_build_object('blocked', true, 'reason', 'Account is frozen');
  END IF;

  -- Check rapid purchases (>10 in 1 minute)
  SELECT count(*) INTO v_purchase_count
  FROM service_transactions
  WHERE user_id = p_user_id AND created_at > now() - interval '1 minute';

  IF v_purchase_count >= 10 THEN
    -- Auto-freeze account
    UPDATE profiles SET is_frozen = true, frozen_reason = 'Automated: >10 purchases in 1 minute', frozen_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO fraud_events (user_id, event_type, description)
    VALUES (p_user_id, 'auto_freeze', 'More than 10 purchases in 1 minute');

    RETURN jsonb_build_object('blocked', true, 'reason', 'Suspicious activity detected');
  END IF;

  RETURN jsonb_build_object('blocked', false);
END;
$$;
