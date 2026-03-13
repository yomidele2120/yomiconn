
-- Fix: rate_limits needs no user-facing RLS policies since it's only accessed via SECURITY DEFINER functions
-- But we need to keep RLS enabled. Add a dummy admin policy.
CREATE POLICY "Admins can view rate limits" ON public.rate_limits
  FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));
