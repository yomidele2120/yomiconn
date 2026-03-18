import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api';
const BD_BASE_URL = 'https://blessdata.com.ng/api';

// CheapDataHub network mapping (our frontend IDs → CDH names)
const cdhNetworkMap: Record<string, string> = {
  '1': 'mtn',
  '2': 'airtel',
  '3': 'glo',
  '4': '9mobile',
};

// BlessData network mapping (our frontend IDs → BD network integers)
// BD: 1=MTN, 2=GLO, 3=9mobile, 4=Airtel
const bdNetworkMap: Record<string, number> = {
  '1': 1, // MTN
  '2': 4, // Airtel
  '3': 2, // Glo
  '4': 3, // 9mobile
};

function parseSizeMB(sizeStr: string): number {
  const lower = sizeStr.toLowerCase().trim();
  const num = parseFloat(lower);
  if (isNaN(num)) return 0;
  if (lower.includes('gb')) return num * 1024;
  if (lower.includes('mb')) return num;
  if (lower.includes('tb')) return num * 1024 * 1024;
  return num;
}

function parseSizeGB(sizeMB: number): number {
  return sizeMB / 1024;
}

// ─── Tiered profit calculation ───
// ₦30 for 1-3GB, ₦50 for 4GB+
function calculateProfit(_basePrice: number, planSizeGB: number): number {
  if (planSizeGB >= 4) return 50;
  if (planSizeGB >= 1) return 30;
  return 0; // sub-1GB
}

async function fetchCdhBundles(networkId: string): Promise<any[]> {
  try {
    const networkName = cdhNetworkMap[networkId];
    if (!networkName) return [];

    const response = await fetch(`${CDH_BASE_URL}/bundles_list/?format=json`);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { return []; }

    if (data.status !== 'true') return [];

    const rawBundles = data[`${networkName}_bundles`] || [];

    return rawBundles.map((bundle: any) => {
      const sizeMB = parseSizeMB(bundle.size || '0');
      const sizeGB = parseSizeGB(sizeMB);
      const originalPrice = bundle.price || 0;
      const planType = bundle.plan_type?.name || '';
      const profit = calculateProfit(originalPrice, sizeGB);
      const finalPrice = originalPrice + profit;

      return {
        id: `cdh_${bundle.id}`,
        name: `${bundle.size} ${planType} (${bundle.duration} days)`,
        price: originalPrice,
        displayPrice: finalPrice,
        profit: finalPrice - originalPrice,
        size_mb: sizeMB,
        provider_source: 'cheapdatahub',
        provider_plan_id: String(bundle.id),
      };
    });
  } catch (e) {
    console.error('CDH bundle fetch error:', e);
    return [];
  }
}

async function fetchBdBundles(networkId: string): Promise<any[]> {
  try {
    const bdNetwork = bdNetworkMap[networkId];
    if (!bdNetwork) return [];

    const BD_API_KEY = Deno.env.get('BLESSDATA_API_KEY');
    if (!BD_API_KEY) return [];

    // Try BlessData data listing endpoint
    const response = await fetch(`${BD_BASE_URL}/data/`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${BD_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { return []; }

    // BlessData may return plans in various formats
    const plans = Array.isArray(data) ? data : (data.plans || data.data || data.results || []);

    return plans
      .filter((p: any) => {
        // Filter by network
        const pNetwork = p.network || p.network_id;
        return pNetwork === bdNetwork || pNetwork === String(bdNetwork);
      })
      .map((p: any) => {
        const sizeMB = parseSizeMB(p.size || p.plan_size || p.data_size || '0');
        const sizeGB = parseSizeGB(sizeMB);
        const originalPrice = p.price || p.plan_price || 0;
        const planName = p.name || p.plan_name || p.description || `${p.size || 'Unknown'}`;
        const profit = calculateProfit(originalPrice, sizeGB);

        return {
          id: `bd_${p.id || p.plan_id}`,
          name: `${planName} [BD]`,
          price: originalPrice,
          displayPrice: originalPrice + profit,
          profit,
          size_mb: sizeMB,
          provider_source: 'blessdata',
          provider_plan_id: String(p.id || p.plan_id),
        };
      });
  } catch (e) {
    console.error('BD bundle fetch error:', e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { network_id } = await req.json();
    if (!network_id) throw new Error('network_id is required');

    // Fetch from both providers in parallel
    const [cdhBundles, bdBundles] = await Promise.all([
      fetchCdhBundles(network_id),
      fetchBdBundles(network_id),
    ]);

    // Merge into unified catalog, sorted by displayPrice
    const bundles = [...cdhBundles, ...bdBundles].sort((a, b) => a.displayPrice - b.displayPrice);

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
