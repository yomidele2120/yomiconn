import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CDH_BASE = 'https://www.cheapdatahub.ng/api';

// Frontend network_id → CDH key prefix
const DATA_NETWORKS: Record<string, string> = {
  '1': 'mtn', '2': 'airtel', '3': 'glo', '4': '9mobile',
};
const CABLE_PROVIDERS = ['dstv', 'gotv', 'startimes'];

// Default profit defaults (preserved from previous useAppSettings tiers)
const DEFAULT_DATA_PROFIT_1_3GB = 30;
const DEFAULT_DATA_PROFIT_4GB_PLUS = 50;
const DEFAULT_CABLE_PROFIT = 100;

function parseSizeMB(sizeStr: string): number {
  const lower = (sizeStr || '').toLowerCase().trim();
  const num = parseFloat(lower);
  if (isNaN(num)) return 0;
  if (lower.includes('tb')) return num * 1024 * 1024;
  if (lower.includes('gb')) return num * 1024;
  return num; // MB
}

function defaultProfitForData(sizeMB: number): number {
  const gb = sizeMB / 1024;
  if (gb >= 4) return DEFAULT_DATA_PROFIT_4GB_PLUS;
  if (gb >= 1) return DEFAULT_DATA_PROFIT_1_3GB;
  return 0;
}

interface SyncedPlan {
  service_type: 'data' | 'cable';
  network_id: string;
  provider_source: string;
  provider_plan_id: string;
  name: string;
  size_mb: number | null;
  provider_cost: number;
  default_profit: number;
  metadata: Record<string, any>;
}

async function fetchDataPlans(): Promise<SyncedPlan[]> {
  const res = await fetch(`${CDH_BASE}/bundles_list/?format=json`);
  const data = await res.json();
  if (data.status !== 'true') return [];

  const out: SyncedPlan[] = [];
  for (const [netId, netKey] of Object.entries(DATA_NETWORKS)) {
    const raw = data[`${netKey}_bundles`] || [];
    for (const b of raw) {
      const sizeMB = parseSizeMB(b.size || '0');
      out.push({
        service_type: 'data',
        network_id: netId,
        provider_source: 'cheapdatahub',
        provider_plan_id: String(b.id),
        name: `${b.size} ${b.plan_type?.name || ''} (${b.duration} days)`.trim(),
        size_mb: sizeMB || null,
        provider_cost: Number(b.price) || 0,
        default_profit: defaultProfitForData(sizeMB),
        metadata: { duration: b.duration, plan_type: b.plan_type?.name, raw_size: b.size },
      });
    }
  }
  return out;
}

async function fetchCablePlans(): Promise<SyncedPlan[]> {
  const res = await fetch(`${CDH_BASE}/cable_list/?format=json`);
  const data = await res.json();
  if (data.status !== 'true') return [];

  const out: SyncedPlan[] = [];
  for (const provider of CABLE_PROVIDERS) {
    const raw = data[`${provider}_plans`] || [];
    for (const p of raw) {
      out.push({
        service_type: 'cable',
        network_id: provider,
        provider_source: 'cheapdatahub',
        provider_plan_id: String(p.id),
        name: p.plan_name || 'Plan',
        size_mb: null,
        provider_cost: Number(p.plan_price) || 0,
        default_profit: DEFAULT_CABLE_PROFIT,
        metadata: {},
      });
    }
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [dataPlans, cablePlans] = await Promise.all([fetchDataPlans(), fetchCablePlans()]);
    const allPlans = [...dataPlans, ...cablePlans];
    const now = new Date().toISOString();

    let inserted = 0;
    let updated = 0;

    for (const p of allPlans) {
      // Upsert preserving existing profit_amount / profit_percent
      const { data: existing } = await admin
        .from('provider_plans')
        .select('id, profit_amount, profit_percent')
        .eq('service_type', p.service_type)
        .eq('provider_source', p.provider_source)
        .eq('provider_plan_id', p.provider_plan_id)
        .maybeSingle();

      if (existing) {
        await admin
          .from('provider_plans')
          .update({
            name: p.name,
            network_id: p.network_id,
            size_mb: p.size_mb,
            provider_cost: p.provider_cost,
            is_active: true,
            last_synced_at: now,
            metadata: p.metadata,
            // profit_amount / profit_percent preserved
          })
          .eq('id', existing.id);
        updated++;
      } else {
        await admin.from('provider_plans').insert({
          service_type: p.service_type,
          network_id: p.network_id,
          provider_source: p.provider_source,
          provider_plan_id: p.provider_plan_id,
          name: p.name,
          size_mb: p.size_mb,
          provider_cost: p.provider_cost,
          profit_amount: p.default_profit,
          profit_percent: 0,
          is_active: true,
          last_synced_at: now,
          metadata: p.metadata,
        });
        inserted++;
      }
    }

    // Disable plans that were not seen in this sync (per service_type + source)
    const seenIds = allPlans.map(p => p.provider_plan_id);
    const { data: disabled } = await admin
      .from('provider_plans')
      .update({ is_active: false })
      .eq('provider_source', 'cheapdatahub')
      .lt('last_synced_at', now)
      .not('provider_plan_id', 'in', `(${seenIds.map(id => `"${id}"`).join(',') || '"__none__"'})`)
      .select('id');

    return new Response(JSON.stringify({
      success: true,
      synced_at: now,
      total: allPlans.length,
      inserted,
      updated,
      disabled: disabled?.length || 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('sync-cheapdatahub-catalog error:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
