
-- Add RLS policy for transaction_pins - only service role can access (via edge functions)
CREATE POLICY "No direct access to pins" ON public.transaction_pins
  FOR ALL TO authenticated
  USING (false);
