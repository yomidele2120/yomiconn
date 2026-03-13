import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api/v1/resellers';

function applyMarkup(sizeMB: number, price: number): number {
  if (sizeMB === 500) return price + 50;
  if (sizeMB === 1024) return price + 70;
  if (sizeMB >= 4096) return price + 100;
  return price;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CDH_API_KEY = Deno.env.get('CHEAPDATAHUB_API_KEY');
    if (!CDH_API_KEY) {
      throw new Error('CHEAPDATAHUB_API_KEY is not configured');
    }

    const { network_id } = await req.json();

    if (!network_id) {
      throw new Error('network_id is required');
    }

    // Fetch bundles from CheapDataHub
    const response = await fetch(`${CDH_BASE_URL}/data/bundles/?network=${network_id}`, {
      headers: {
        'Authorization': `Bearer ${CDH_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || 'Failed to fetch bundles');
    }

    // Apply markup to bundles
    const bundles = (data?.data || data?.bundles || data || []).map((bundle: any) => {
      const sizeMB = bundle.size_mb || bundle.size || 0;
      const originalPrice = bundle.price || bundle.amount || 0;
      return {
        id: String(bundle.id || bundle.bundle_id),
        name: bundle.name || bundle.description || `${sizeMB}MB`,
        price: originalPrice,
        displayPrice: applyMarkup(sizeMB, originalPrice),
        size_mb: sizeMB,
      };
    });

    return new Response(JSON.stringify({ bundles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message, bundles: [] }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
