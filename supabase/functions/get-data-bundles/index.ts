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
    const { network_id } = await req.json();
    if (!network_id) throw new Error('network_id is required');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await admin
      .from('provider_plans')
      .select('id, provider_source, provider_plan_id, name, size_mb, provider_cost, profit_amount, profit_percent')
      .eq('service_type', 'data')
      .eq('network_id', String(network_id))
      .eq('is_active', true);

    if (error) throw error;

    const bundles = (data || [])
      .map((p) => {
        const displayPrice = Math.round(
          (Number(p.provider_cost) + Number(p.profit_amount) + (Number(p.provider_cost) * Number(p.profit_percent) / 100)) * 100
        ) / 100;
        const profit = Math.round((displayPrice - Number(p.provider_cost)) * 100) / 100;
        return {
          id: `${p.provider_source}_${p.provider_plan_id}`,
          name: p.name,
          price: Number(p.provider_cost),
          displayPrice,
          profit,
          size_mb: p.size_mb || 0,
          provider_source: p.provider_source,
          provider_plan_id: p.provider_plan_id,
        };
      })
      .sort((a, b) => a.displayPrice - b.displayPrice);

    return new Response(JSON.stringify({ bundles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('get-data-bundles error:', message);
    return new Response(JSON.stringify({ error: message, bundles: [] }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
