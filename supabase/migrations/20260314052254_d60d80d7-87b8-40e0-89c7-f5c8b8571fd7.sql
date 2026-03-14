
-- Payment sessions table for tracking wallet funding
CREATE TABLE public.payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reference text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  paystack_reference text,
  authorization_url text
);

ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment sessions" ON public.payment_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment sessions" ON public.payment_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Index for webhook lookups
CREATE INDEX idx_payment_sessions_reference ON public.payment_sessions(reference);
CREATE INDEX idx_payment_sessions_paystack_ref ON public.payment_sessions(paystack_reference);

-- Trigger for updated_at
CREATE TRIGGER update_payment_sessions_updated_at
  BEFORE UPDATE ON public.payment_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
