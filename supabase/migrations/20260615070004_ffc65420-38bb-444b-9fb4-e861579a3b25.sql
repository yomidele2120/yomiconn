CREATE TABLE public.provider_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL CHECK (service_type IN ('data','cable')),
  network_id text NOT NULL,
  provider_source text NOT NULL DEFAULT 'cheapdatahub',
  provider_plan_id text NOT NULL,
  name text NOT NULL,
  size_mb integer,
  provider_cost numeric(12,2) NOT NULL DEFAULT 0,
  profit_amount numeric(12,2) NOT NULL DEFAULT 0,
  profit_percent numeric(6,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_type, provider_source, provider_plan_id)
);

GRANT SELECT ON public.provider_plans TO authenticated;
GRANT ALL ON public.provider_plans TO service_role;

ALTER TABLE public.provider_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active plans"
  ON public.provider_plans FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage plans"
  ON public.provider_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_provider_plans_updated_at
  BEFORE UPDATE ON public.provider_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_provider_plans_lookup
  ON public.provider_plans (service_type, network_id, is_active);

-- Helper to compute selling price (provider_cost + flat profit + percent markup)
CREATE OR REPLACE FUNCTION public.compute_selling_price(
  p_cost numeric, p_flat numeric, p_percent numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT round(p_cost + p_flat + (p_cost * p_percent / 100.0), 2)
$$;