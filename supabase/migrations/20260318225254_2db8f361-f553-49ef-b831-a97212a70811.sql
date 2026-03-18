
-- Transaction PINs table (accessed only via edge functions with service role)
CREATE TABLE public.transaction_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.transaction_pins ENABLE ROW LEVEL SECURITY;

-- App settings table (admin-configurable)
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can insert settings" ON public.app_settings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update settings" ON public.app_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('data_profit_1_3gb', '30'),
  ('data_profit_4gb_plus', '50'),
  ('funding_fee_below_5000', '35'),
  ('funding_fee_above_5000', '50'),
  ('pin_required', 'true');

-- Function to check if user has a PIN
CREATE OR REPLACE FUNCTION public.has_transaction_pin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM transaction_pins WHERE user_id = p_user_id)
$$;
