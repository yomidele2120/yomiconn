import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ELRUFAI_BASE_URL = Deno.env.get('ELRUFAI_BASE_URL') || 'https://elrufaidatalink.com/api';

// Our network IDs: 1=MTN, 2=Airtel, 3=Glo, 4=9mobile
// ElRufai (Bilal-family) network IDs: 1=MTN, 2=GLO, 3=9mobile, 4=Airtel
const ELRUFAI_NETWORK_MAP: Record<string, number> = { '1': 1, '2': 4, '3': 2, '4': 3 };

interface AppSettings {
  data_profit_1_3gb: number;
  data_profit_4gb_plus: number;
}

async function loadSettings(admin: any): Promise<AppSettings> {
  const defaults: AppSettings = { data_profit_1_3gb: 30, data_profit_4gb_plus: 50 };
  try {
    const { data } = await admin.from('app_settings').select('key,value');
    for (const r of data || []) {
      if (r.key in defaults) {
        (defaults as any)[r.key] = typeof r.value === 'number' ? r.value : Number(r.value);
      }
    }
  } catch { /* ignore */ }
  return defaults;
}

function estimateMb(plan: string): number {
  // "1GB", "500MB", "1.5GB", "SME 1GB"
  const s = String(plan || '').toUpperCase();
  const gbM = s.match(/([\d.]+)\s*GB/);
  if (gbM) return Math.round(parseFloat(gbM[1]) * 1024);
  const mbM = s.match(/([\d.]+)\s*MB/);
  if (mbM) return Math.round(parseFloat(mbM[1]));
  return 0;
}

function markupPrice(cost: number, sizeMb: number, s: AppSettings): number {
  const gb = sizeMb / 1024;
  const flat = gb >= 4 ? s.data_profit_4gb_plus : s.data_profit_1_3gb;
  return Math.round(cost + flat);
}

async function fetchElRufaiBundles(networkId: string, s: AppSettings) {
  const apiKey = Deno.env.get('ELRUFAIDATALINK_API_KEY') || Deno.env.get('ELRUFAI_API_KEY');
  if (!apiKey) throw new Error('ElRufaiDataSub API key not configured');
  console.log('[ELRUFAI] key length:', apiKey.length, 'prefix:', apiKey.slice(0, 6));

  const targetNet = ELRUFAI_NETWORK_MAP[networkId];
  if (!targetNet) return [];

  const endpoints = ['/user/', '/data_plans/', '/plans/', '/data/'];
  const authSchemes = [
    { name: 'Token', headers: { 'Authorization': `Token ${apiKey}` } },
    { name: 'Bearer', headers: { 'Authorization': `Bearer ${apiKey}` } },
    { name: 'X-API-Key', headers: { 'X-API-Key': apiKey } },
  ];

  let plans: any[] = [];
  const attempts: string[] = [];

  outer: for (const ep of endpoints) {
    for (const scheme of authSchemes) {
      try {
        const res = await fetch(`${ELRUFAI_BASE_URL}${ep}`, {
          headers: { ...scheme.headers, 'Content-Type': 'application/json' },
        });
        const text = await res.text();
        attempts.push(`${ep}[${scheme.name}]=${res.status}`);
        if (!res.ok) continue;
        let body: any;
        try { body = JSON.parse(text); } catch { continue; }

        const collected: any[] = [];
        const scan = (node: any) => {
          if (!node) return;
          if (Array.isArray(node)) { for (const it of node) if (it && typeof it === 'object') collected.push(it); return; }
          if (typeof node === 'object') for (const v of Object.values(node)) scan(v);
        };
        scan(body.Dataplans || body.plans || body.data || body);
        plans = collected.filter((p: any) => p && (p.dataplan_id || p.plan_id || p.plan_amount) && (p.plan_network_id !== undefined || p.plan_network !== undefined || p.network !== undefined));
        if (plans.length) {
          console.log('[ELRUFAI] success via', ep, scheme.name, 'plans:', plans.length, 'sample:', JSON.stringify(plans[0]));
          break outer;
        }
      } catch (e) {
        attempts.push(`${ep}[${scheme.name}]=ERR:${(e as Error).message}`);
      }
    }
  }

  if (!plans.length) {
    console.log('[ELRUFAI] no plans. attempts:', attempts.join(', '));
    return [];
  }

  const netCounts: Record<string, number> = {};
  for (const p of plans) {
    const n = String(p.plan_network_id ?? p.plan_network ?? p.network ?? '?');
    netCounts[n] = (netCounts[n] || 0) + 1;
  }
  console.log('[ELRUFAI] network distribution:', JSON.stringify(netCounts), 'targetNet:', targetNet);


  return plans
    .filter((p: any) => {
      const net = Number(p.network ?? p.plan_network_id);
      return net === targetNet;
    })
    .map((p: any) => {
      const id = String(p.dataplan_id ?? p.id ?? p.plan_id ?? '');
      const planName = String(p.plan ?? p.plan_name ?? p.name ?? '');
      const cost = Number(p.plan_amount ?? p.amount ?? p.price ?? 0);
      const validity = String(p.month_validate ?? p.validity ?? p.duration ?? '');
      const type = String(p.plan_type ?? '');
      const sizeMb = estimateMb(planName);
      const displayPrice = markupPrice(cost, sizeMb, s);
      const label = [type, planName, validity].filter(Boolean).join(' · ');
      return {
        id: `elrufaidatalink_${id}`,
        name: label || planName || `Plan ${id}`,
        price: cost,
        displayPrice,
        profit: displayPrice - cost,
        size_mb: sizeMb,
        validity,
        provider_source: 'elrufaidatalink',
        provider_plan_id: id,
      };
    })
    .filter((b) => b.provider_plan_id && b.price > 0)
    .sort((a, b) => a.displayPrice - b.displayPrice);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { network_id, provider_source } = await req.json();
    if (!network_id) throw new Error('network_id is required');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const source = String(provider_source || 'cheapdatahub');

    // ElRufai: live fetch, no DB
    if (source === 'elrufaidatalink' || source === 'elrufai') {
      const settings = await loadSettings(admin);
      const bundles = await fetchElRufaiBundles(String(network_id), settings);
      return new Response(JSON.stringify({ bundles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: DB-backed (CheapDataHub)
    let q = admin
      .from('provider_plans')
      .select('id, provider_source, provider_plan_id, name, size_mb, provider_cost, profit_amount, profit_percent')
      .eq('service_type', 'data')
      .eq('network_id', String(network_id))
      .eq('is_active', true)
      .eq('provider_source', source);

    const { data, error } = await q;
    if (error) throw error;

    const bundles = (data || [])
      .map((p) => {
        const displayPrice = Math.round(
          (Number(p.provider_cost) + Number(p.profit_amount) + (Number(p.provider_cost) * Number(p.profit_percent) / 100)) * 100
        ) / 100;
        return {
          id: `${p.provider_source}_${p.provider_plan_id}`,
          name: p.name,
          price: Number(p.provider_cost),
          displayPrice,
          profit: Math.round((displayPrice - Number(p.provider_cost)) * 100) / 100,
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
