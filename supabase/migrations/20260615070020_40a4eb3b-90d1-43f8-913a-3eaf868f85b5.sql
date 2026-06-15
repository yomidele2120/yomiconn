CREATE OR REPLACE FUNCTION public.compute_selling_price(
  p_cost numeric, p_flat numeric, p_percent numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT round(p_cost + p_flat + (p_cost * p_percent / 100.0), 2)
$$;

REVOKE EXECUTE ON FUNCTION public.compute_selling_price(numeric, numeric, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_selling_price(numeric, numeric, numeric) TO service_role;