
-- Table for reseller/partner API keys
CREATE TABLE public.reseller_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key text NOT NULL UNIQUE,
  partner_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  permissions text[] NOT NULL DEFAULT ARRAY['airtime','data','cable','electricity'],
  rate_limit_per_minute integer NOT NULL DEFAULT 30,
  total_requests bigint NOT NULL DEFAULT 0,
  last_used_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reseller_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reseller keys" ON public.reseller_api_keys FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert reseller keys" ON public.reseller_api_keys FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update reseller keys" ON public.reseller_api_keys FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete reseller keys" ON public.reseller_api_keys FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_reseller_api_keys_updated_at BEFORE UPDATE ON public.reseller_api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to validate an API key (used by edge functions, bypasses RLS)
CREATE OR REPLACE FUNCTION public.validate_api_key(p_api_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record reseller_api_keys%ROWTYPE;
  v_recent_count int;
BEGIN
  SELECT * INTO v_record FROM reseller_api_keys WHERE api_key = p_api_key;
  
  IF v_record IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid API key');
  END IF;
  
  IF NOT v_record.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'API key is disabled');
  END IF;
  
  -- Rate limit check
  SELECT count(*) INTO v_recent_count
  FROM rate_limits
  WHERE user_id = v_record.created_by
    AND action = 'reseller_api'
    AND created_at > now() - interval '1 minute';
  
  IF v_recent_count >= v_record.rate_limit_per_minute THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Rate limit exceeded');
  END IF;
  
  -- Track usage
  INSERT INTO rate_limits (user_id, action) VALUES (v_record.created_by, 'reseller_api');
  UPDATE reseller_api_keys SET total_requests = total_requests + 1, last_used_at = now() WHERE id = v_record.id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'partner_name', v_record.partner_name,
    'permissions', to_jsonb(v_record.permissions),
    'key_id', v_record.id,
    'owner_id', v_record.created_by
  );
END;
$$;
