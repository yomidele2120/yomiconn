import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api';

const networkMap: Record<string, string> = {
  '1': 'mtn',
  '2': 'airtel',
  '3': 'glo',
  '4': '9mobile',
};

function parseSizeMB(sizeStr: string): number {
  const lower = sizeStr.toLowerCase().trim();
  const num = parseFloat(lower);
  if (lower.includes('gb')) return num * 1024;
  if (lower.includes('mb')) return num;
  if (lower.includes('tb')) return num * 1024 * 1024;
  return num;
}

function applyMarkup(sizeMB: number, price: number): number {
  if (sizeMB === 500) return price + 50;
  if (sizeMB >= 1024 && sizeMB < 2048) return price + 70;
  if (sizeMB >= 4096) return price + 100;
  return price;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { network_id } = await req.json();

    if (!network_id) {
      throw new Error('network_id is required');
    }

    const networkName = networkMap[network_id];
    if (!networkName) {
      throw new Error('Invalid network_id');
    }

    // Fetch bundles from CheapDataHub public endpoint
    const response = await fetch(`${CDH_BASE_URL}/bundles_list/?format=json`);

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Non-JSON response from CheapDataHub:', responseText.substring(0, 200));
      throw new Error('CheapDataHub API returned non-JSON response');
    }

    if (data.status !== 'true') {
      throw new Error(data.message || 'Failed to fetch bundles');
    }

    // Get the correct network bundles
    const bundleKey = `${networkName}_bundles`;
    const rawBundles = data[bundleKey] || [];

    // Apply markup to bundles
    const bundles = rawBundles.map((bundle: any) => {
      const sizeMB = parseSizeMB(bundle.size || '0');
      const originalPrice = bundle.price || 0;
      const planType = bundle.plan_type?.name || '';
      return {
        id: String(bundle.id),
        name: `${bundle.size} ${planType} (${bundle.duration} days)`,
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
    console.error('get-data-bundles error:', message);
    return new Response(JSON.stringify({ error: message, bundles: [] }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
