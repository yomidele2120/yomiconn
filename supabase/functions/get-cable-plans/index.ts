import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider_id } = await req.json();
    if (!provider_id) throw new Error('provider_id is required');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await admin
      .from('provider_plans')
      .select('provider_source, provider_plan_id, name, provider_cost, profit_amount, profit_percent')
      .eq('service_type', 'cable')
      .eq('network_id', String(provider_id))
      .eq('is_active', true);

    if (error) throw error;

    const plans = (data || [])
      .map((p) => {
        const price = Math.round(
          (Number(p.provider_cost) + Number(p.profit_amount) + (Number(p.provider_cost) * Number(p.profit_percent) / 100)) * 100
        ) / 100;
        return {
          id: `${p.provider_source}_${p.provider_plan_id}`,
          name: p.name,
          price,
          provider_source: p.provider_source,
          provider_plan_id: p.provider_plan_id,
        };
      })
      .sort((a, b) => a.price - b.price);

    return new Response(JSON.stringify({ plans }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('get-cable-plans error:', message);
    return new Response(JSON.stringify({ error: message, plans: [] }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
