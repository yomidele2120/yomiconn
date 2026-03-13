import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api';

const providerMap: Record<string, string> = {
  'dstv': 'dstv',
  'gotv': 'gotv',
  'startimes': 'startimes',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider_id } = await req.json();

    if (!provider_id) {
      throw new Error('provider_id is required');
    }

    const providerName = providerMap[provider_id];
    if (!providerName) {
      throw new Error('Invalid provider_id');
    }

    // Fetch cable plans from CheapDataHub public endpoint
    const response = await fetch(`${CDH_BASE_URL}/cable_list/?format=json`);

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Non-JSON response from CheapDataHub:', responseText.substring(0, 200));
      throw new Error('CheapDataHub API returned non-JSON response');
    }

    if (data.status !== 'true') {
      throw new Error(data.message || 'Failed to fetch plans');
    }

    // Get the correct provider plans
    const planKey = `${providerName}_plans`;
    const rawPlans = data[planKey] || [];

    const plans = rawPlans.map((plan: any) => ({
      id: String(plan.id),
      name: plan.plan_name || 'Plan',
      price: plan.plan_price || 0,
    }));

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
