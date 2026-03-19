import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api';
const HD_BASE_URL = 'https://hadidata.com/api';

// Our frontend IDs → CDH network names
const cdhNetworkMap: Record<string, string> = {
  '1': 'mtn',
  '2': 'airtel',
  '3': 'glo',
  '4': '9mobile',
};

// Our frontend IDs → Hadi Data network integers
// Hadi: 1=MTN, 2=GLO, 3=9Mobile, 4=Airtel
const hdNetworkMap: Record<string, number> = {
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
  return 0; // sub-1GB plans: no markup
}

// ─── CheapDataHub bundles ───
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

      return {
        id: `cdh_${bundle.id}`,
        name: `${bundle.size} ${planType} (${bundle.duration} days)`,
        price: originalPrice,
        displayPrice: originalPrice + profit,
        profit,
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

// ─── Hadi Data bundles (static pricing from API docs) ───
// Hadi Data network IDs: 1=MTN, 2=GLO, 3=9Mobile, 4=Airtel
const HADI_PLANS: Record<number, Array<{ plan_id: number; type: string; size: string; price: number; validity: string }>> = {
  1: [ // MTN
    { plan_id: 55, type: 'CG', size: '500MB', price: 330, validity: '30days' },
    { plan_id: 51, type: 'CG', size: '1GB', price: 550, validity: '30days' },
    { plan_id: 52, type: 'CG', size: '2GB', price: 1100, validity: '30days' },
    { plan_id: 53, type: 'CG', size: '3GB', price: 1650, validity: '30days' },
    { plan_id: 54, type: 'CG', size: '5GB', price: 2750, validity: '30days' },
    { plan_id: 71, type: 'GIFTING', size: '501MB', price: 250, validity: '7days' },
    { plan_id: 72, type: 'GIFTING', size: '1GB', price: 300, validity: '1day' },
    { plan_id: 75, type: 'GIFTING', size: '1.2GB', price: 520, validity: '30days' },
    { plan_id: 74, type: 'GIFTING', size: '2.5GB', price: 600, validity: '1day' },
    { plan_id: 56, type: 'SME', size: '500MB', price: 360, validity: '7days' },
    { plan_id: 47, type: 'SME', size: '1GB', price: 500, validity: '7days' },
    { plan_id: 48, type: 'SME', size: '2GB', price: 1000, validity: '7days' },
    { plan_id: 49, type: 'SME', size: '3GB', price: 1500, validity: '7days' },
    { plan_id: 50, type: 'SME', size: '5GB', price: 2500, validity: '7days' },
  ],
  4: [ // Airtel (Hadi network ID 4)
    { plan_id: 76, type: 'CG', size: '100MB', price: 110, validity: '1day' },
    { plan_id: 26, type: 'CG', size: '300MB', price: 300, validity: '2days' },
    { plan_id: 27, type: 'CG', size: '500MB', price: 500, validity: '7days' },
    { plan_id: 28, type: 'CG', size: '1GB', price: 800, validity: '7days' },
    { plan_id: 57, type: 'CG', size: '1.5GB', price: 1097, validity: '7days' },
    { plan_id: 29, type: 'CG', size: '2GB', price: 1600, validity: '30days' },
    { plan_id: 30, type: 'CG', size: '3GB', price: 2400, validity: '30days' },
    { plan_id: 77, type: 'CG', size: '6GB', price: 3000, validity: '7days' },
    { plan_id: 41, type: 'CG', size: '4GB', price: 3200, validity: '30days' },
    { plan_id: 42, type: 'CG', size: '8GB', price: 6400, validity: '30days' },
    { plan_id: 43, type: 'CG', size: '10GB', price: 8000, validity: '30days' },
    { plan_id: 58, type: 'SME', size: '150MB', price: 60, validity: '1day' },
    { plan_id: 59, type: 'SME', size: '300MB', price: 110, validity: '2days' },
    { plan_id: 60, type: 'SME', size: '600MB', price: 220, validity: '2days' },
    { plan_id: 88, type: 'SME', size: '1.5GB', price: 510, validity: '7days' },
    { plan_id: 83, type: 'SME', size: '2GB', price: 520, validity: '2days' },
    { plan_id: 84, type: 'SME', size: '4GB', price: 760, validity: '2days' },
    { plan_id: 85, type: 'SME', size: '5GB', price: 1010, validity: '2days' },
    { plan_id: 62, type: 'SME', size: '3GB', price: 1020, validity: '2days' },
    { plan_id: 86, type: 'SME', size: '7GB', price: 2010, validity: '7days' },
    { plan_id: 63, type: 'SME', size: '10GB', price: 3060, validity: '30days' },
  ],
  2: [ // GLO (Hadi network ID 2)
    { plan_id: 82, type: 'CG', size: '200MB', price: 110, validity: '30days' },
    { plan_id: 32, type: 'CG', size: '500MB', price: 200, validity: '30days' },
    { plan_id: 80, type: 'CG', size: '1GB', price: 320, validity: '7days' },
    { plan_id: 78, type: 'CG', size: '1GB', price: 350, validity: '3days' },
    { plan_id: 81, type: 'CG', size: '1GB', price: 415, validity: '30days' },
    { plan_id: 34, type: 'CG', size: '2GB', price: 800, validity: '30days' },
    { plan_id: 35, type: 'CG', size: '3GB', price: 1200, validity: '30days' },
    { plan_id: 36, type: 'CG', size: '5GB', price: 2000, validity: '30days' },
    { plan_id: 79, type: 'CG', size: '10GB', price: 4500, validity: '30days' },
    { plan_id: 91, type: 'GIFTING', size: '3GB', price: 850, validity: '3days' },
    { plan_id: 92, type: 'GIFTING', size: '5GB', price: 1400, validity: '3days' },
  ],
  3: [ // 9Mobile (Hadi network ID 3)
    { plan_id: 64, type: 'CG', size: '500MB', price: 200, validity: '30days' },
    { plan_id: 65, type: 'CG', size: '1GB', price: 400, validity: '30days' },
    { plan_id: 66, type: 'CG', size: '2GB', price: 800, validity: '30days' },
    { plan_id: 67, type: 'CG', size: '3GB', price: 1200, validity: '30days' },
    { plan_id: 68, type: 'CG', size: '4GB', price: 1600, validity: '30days' },
  ],
};

function fetchHdBundles(networkId: string): any[] {
  try {
    const hdNetwork = hdNetworkMap[networkId];
    if (!hdNetwork) return [];

    const HD_API_KEY = Deno.env.get('HADI_DATA_API');
    if (!HD_API_KEY) return [];

    const plans = HADI_PLANS[hdNetwork] || [];

    return plans.map((p) => {
      const sizeMB = parseSizeMB(p.size);
      const sizeGB = parseSizeGB(sizeMB);
      const profit = calculateProfit(p.price, sizeGB);

      return {
        id: `hd_${p.plan_id}`,
        name: `${p.size} ${p.type} (${p.validity})`,
        price: p.price,
        displayPrice: p.price + profit,
        profit,
        size_mb: sizeMB,
        provider_source: 'hadidata',
        provider_plan_id: String(p.plan_id),
      };
    });
  } catch (e) {
    console.error('HD bundle fetch error:', e);
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

    // Fetch CDH from API, HD from static catalog
    const [cdhBundles] = await Promise.all([
      fetchCdhBundles(network_id),
    ]);
    const hdBundles = fetchHdBundles(network_id);

    // Merge into unified catalog, sorted by displayPrice
    const bundles = [...cdhBundles, ...hdBundles].sort((a, b) => a.displayPrice - b.displayPrice);

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
