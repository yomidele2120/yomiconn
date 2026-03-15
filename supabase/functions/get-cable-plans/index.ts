import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api';
const BD_BASE_URL = 'https://blessdata.com.ng/api';

const providerMap: Record<string, string> = {
  'dstv': 'dstv',
  'gotv': 'gotv',
  'startimes': 'startimes',
};

async function fetchCdhPlans(providerId: string): Promise<any[]> {
  try {
    const providerName = providerMap[providerId];
    if (!providerName) return [];

    const response = await fetch(`${CDH_BASE_URL}/cable_list/?format=json`);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { return []; }
    if (data.status !== 'true') return [];

    const rawPlans = data[`${providerName}_plans`] || [];
    return rawPlans.map((plan: any) => ({
      id: `cdh_${plan.id}`,
      name: plan.plan_name || 'Plan',
      price: plan.plan_price || 0,
      provider_source: 'cheapdatahub',
      provider_plan_id: String(plan.id),
    }));
  } catch (e) {
    console.error('CDH cable plans error:', e);
    return [];
  }
}

async function fetchBdPlans(providerId: string): Promise<any[]> {
  try {
    const BD_API_KEY = Deno.env.get('BLESSDATA_API_KEY');
    if (!BD_API_KEY) return [];

    const response = await fetch(`${BD_BASE_URL}/cabletv/`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${BD_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { return []; }

    const plans = Array.isArray(data) ? data : (data.plans || data.data || data.results || []);

    return plans
      .filter((p: any) => {
        const pProvider = (p.cable_name || p.provider || '').toLowerCase();
        return pProvider.includes(providerId);
      })
      .map((p: any) => ({
        id: `bd_${p.id || p.plan_id}`,
        name: `${p.plan_name || p.name || 'Plan'} [BD]`,
        price: p.plan_price || p.price || 0,
        provider_source: 'blessdata',
        provider_plan_id: String(p.id || p.plan_id),
      }));
  } catch (e) {
    console.error('BD cable plans error:', e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider_id } = await req.json();
    if (!provider_id) throw new Error('provider_id is required');

    const providerName = providerMap[provider_id];
    if (!providerName) throw new Error('Invalid provider_id');

    const [cdhPlans, bdPlans] = await Promise.all([
      fetchCdhPlans(provider_id),
      fetchBdPlans(provider_id),
    ]);

    const plans = [...cdhPlans, ...bdPlans].sort((a, b) => a.price - b.price);

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
