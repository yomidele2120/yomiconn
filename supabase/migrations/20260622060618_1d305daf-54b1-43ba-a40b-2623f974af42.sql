-- Bridgenetics virtual account fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bn_va_id text,
  ADD COLUMN IF NOT EXISTS bn_account_number text,
  ADD COLUMN IF NOT EXISTS bn_account_name text,
  ADD COLUMN IF NOT EXISTS bn_bank_name text,
  ADD COLUMN IF NOT EXISTS bn_created_at timestamptz;

-- Idempotency log for incoming Bridgenetics webhook events
CREATE TABLE IF NOT EXISTS public.bridgenetic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  reference text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bridgenetic_events TO authenticated;
GRANT ALL ON public.bridgenetic_events TO service_role;

ALTER TABLE public.bridgenetic_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all bridgenetic events"
ON public.bridgenetic_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own bridgenetic events"
ON public.bridgenetic_events FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bridgenetic_events_user_idx ON public.bridgenetic_events(user_id, created_at DESC);
