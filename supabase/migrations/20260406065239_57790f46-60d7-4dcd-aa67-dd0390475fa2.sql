
-- Table to store API provider configurations (base URLs, active status)
CREATE TABLE public.api_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  base_url text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write
CREATE POLICY "Admins can view api_providers" ON public.api_providers FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert api_providers" ON public.api_providers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update api_providers" ON public.api_providers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete api_providers" ON public.api_providers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_api_providers_updated_at BEFORE UPDATE ON public.api_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default providers
INSERT INTO public.api_providers (provider_key, display_name, base_url, is_active) VALUES
  ('cheapdatahub', 'CheapDataHub', 'https://www.cheapdatahub.ng/api/v1/resellers', true),
  ('elrufai', 'ElRufaiDataSub', 'https://api.elrufaids.com', false),
  ('blessdata', 'BlessData', 'https://blessdata.com.ng/api', false);
