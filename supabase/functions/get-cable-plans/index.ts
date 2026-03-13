import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api/v1/resellers';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CDH_API_KEY = Deno.env.get('CHEAPDATAHUB_API_KEY');
    if (!CDH_API_KEY) {
      throw new Error('CHEAPDATAHUB_API_KEY is not configured');
    }

    const { provider_id } = await req.json();

    if (!provider_id) {
      throw new Error('provider_id is required');
    }

    const response = await fetch(`${CDH_BASE_URL}/cable/plans/?provider=${provider_id}`, {
      headers: {
        'Authorization': `Bearer ${CDH_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || 'Failed to fetch plans');
    }

    const plans = (data?.data || data?.plans || data || []).map((plan: any) => ({
      id: String(plan.id || plan.plan_id),
      name: plan.name || plan.description || 'Plan',
      price: plan.price || plan.amount || 0,
    }));

    return new Response(JSON.stringify({ plans }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message, plans: [] }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
