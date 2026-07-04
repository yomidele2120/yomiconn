import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NETWORK_NAMES: Record<string, string> = { '1': 'MTN', '2': 'Airtel', '3': 'Glo', '4': '9mobile' };

interface Deal {
  network_id: string;
  network_name: string;
  size_mb: number;
  size_label: string;
  price: number;
  validity: string;
  provider_source: string;
  provider_label: string;
  provider_plan_id: string;
  name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const settings = { data_profit_1_3gb: 30, data_profit_4gb_plus: 50 };
    try {
      const { data } = await admin.from('app_settings').select('key,value');
      for (const r of data || []) {
        if (r.key in settings) (settings as any)[r.key] = Number(r.value);
      }
    } catch { /* ignore */ }

    const markup = (cost: number, sizeMb: number) => {
      const gb = sizeMb / 1024;
      const flat = gb >= 4 ? settings.data_profit_4gb_plus : settings.data_profit_1_3gb;
      return Math.round(cost + flat);
    };

    const allDeals: Deal[] = [];

    // Provider 1: CheapDataHub from DB
    try {
      const { data: cdh } = await admin
        .from('provider_plans')
        .select('provider_source, provider_plan_id, name, size_mb, provider_cost, profit_amount, profit_percent, network_id, validity_days')
        .eq('service_type', 'data')
        .eq('is_active', true)
        .eq('provider_source', 'cheapdatahub');
      for (const p of cdh || []) {
        const cost = Number(p.provider_cost);
        const price = Math.round(cost + Number(p.profit_amount) + (cost * Number(p.profit_percent) / 100));
        const sizeMb = Number(p.size_mb) || 0;
        allDeals.push({
          network_id: String(p.network_id),
          network_name: NETWORK_NAMES[String(p.network_id)] || 'Unknown',
          size_mb: sizeMb,
          size_label: sizeMb >= 1024 ? `${(sizeMb / 1024).toFixed(sizeMb % 1024 === 0 ? 0 : 1)}GB` : `${sizeMb}MB`,
          price,
          validity: p.validity_days ? `${p.validity_days} Days` : '',
          provider_source: 'cheapdatahub',
          provider_label: 'Provider 1',
          provider_plan_id: String(p.provider_plan_id),
          name: p.name || '',
        });
      }
    } catch (e) {
      console.error('[cheapest] CDH failed:', e);
    }

    // Provider 2: ElRufai live
    try {
      const apiKey = Deno.env.get('ELRUFAIDATALINK_API_KEY') || Deno.env.get('ELRUFAI_API_KEY');
      const base = Deno.env.get('ELRUFAI_BASE_URL') || 'https://elrufaidatalink.com/api';
      if (apiKey) {
        const res = await fetch(`${base}/user/`, {
          headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const body = await res.json();
          const collected: any[] = [];
          const scan = (n: any) => {
            if (!n) return;
            if (Array.isArray(n)) { for (const it of n) if (it && typeof it === 'object') collected.push(it); return; }
            if (typeof n === 'object') for (const v of Object.values(n)) scan(v);
          };
          scan(body.Dataplans || body.plans || body.data || body);
          // Map ElRufai net → ours
          const rev: Record<number, string> = { 1: '1', 4: '2', 2: '3', 3: '4' };
          for (const p of collected) {
            const net = Number(p.plan_network_id ?? p.plan_network ?? p.network);
            const ourNet = rev[net];
            if (!ourNet) continue;
            const planName = String(p.plan ?? p.plan_name ?? p.name ?? '');
            const cost = Number(p.plan_amount ?? p.amount ?? p.price ?? 0);
            if (!cost) continue;
            const s = planName.toUpperCase();
            let sizeMb = 0;
            const gbM = s.match(/([\d.]+)\s*GB/); const mbM = s.match(/([\d.]+)\s*MB/);
            if (gbM) sizeMb = Math.round(parseFloat(gbM[1]) * 1024);
            else if (mbM) sizeMb = Math.round(parseFloat(mbM[1]));
            const price = markup(cost, sizeMb);
            allDeals.push({
              network_id: ourNet,
              network_name: NETWORK_NAMES[ourNet] || 'Unknown',
              size_mb: sizeMb,
              size_label: sizeMb >= 1024 ? `${(sizeMb / 1024).toFixed(sizeMb % 1024 === 0 ? 0 : 1)}GB` : `${sizeMb}MB`,
              price,
              validity: String(p.month_validate ?? p.validity ?? p.duration ?? ''),
              provider_source: 'elrufaidatalink',
              provider_label: 'Provider 2',
              provider_plan_id: String(p.dataplan_id ?? p.id ?? ''),
              name: planName,
            });
          }
        }
      }
    } catch (e) {
      console.error('[cheapest] ElRufai failed:', e);
    }

    // Prioritize 1GB (900–1200MB). If none, fall back to plans nearest 1GB.
    const oneGb = allDeals.filter((d) => d.size_mb >= 900 && d.size_mb <= 1200);
    let selected = oneGb;
    if (!selected.length) {
      selected = [...allDeals].sort((a, b) => Math.abs(a.size_mb - 1024) - Math.abs(b.size_mb - 1024)).slice(0, 12);
    }

    // Dedup by network — keep cheapest per network
    const perNet = new Map<string, Deal>();
    for (const d of selected.sort((a, b) => a.price - b.price)) {
      if (!perNet.has(d.network_id) || perNet.get(d.network_id)!.price > d.price) {
        perNet.set(d.network_id, d);
      }
    }
    const top = [...perNet.values()].sort((a, b) => a.price - b.price).slice(0, 4);

    return new Response(JSON.stringify({ deals: top, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('get-cheapest-bundles error:', message);
    return new Response(JSON.stringify({ error: message, deals: [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
