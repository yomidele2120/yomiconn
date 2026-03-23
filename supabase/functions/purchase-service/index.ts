import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api/v1/resellers';
const HD_BASE_URL = 'https://hadidata.com/api';

// Network mapping: our frontend IDs → Hadi Data network IDs
// Ours: 1=MTN, 2=Airtel, 3=Glo, 4=9mobile
// Hadi: 1=MTN, 2=GLO, 3=9Mobile, 4=Airtel
const HD_NETWORK_MAP: Record<string, number> = {
  '1': 1,
  '2': 4,
  '3': 2,
  '4': 3,
};

// ─── Provider API helpers ───

async function callCheapDataHub(
  apiKey: string,
  serviceType: string,
  params: Record<string, any>,
  amount: number
): Promise<{ ok: boolean; data: any }> {
  let endpoint = '';
  let apiBody: Record<string, any> = {};

  switch (serviceType) {
    case 'airtime':
      endpoint = '/airtime/purchase/';
      apiBody = { provider_id: params.provider_id, phone_number: params.phone_number, amount };
      break;
    case 'data':
      endpoint = '/data/purchase/';
      apiBody = { bundle_id: params.provider_plan_id || params.bundle_id, phone_number: params.phone_number };
      break;
    case 'electricity':
      endpoint = '/electricity/purchase/';
      apiBody = { disco: params.disco, meter_no: params.meter_no, amount, phone_number: params.phone_number, meter_type: params.meter_type };
      break;
    case 'cable':
      endpoint = '/cable/purchase/';
      apiBody = { smartcard_no: params.smartcard_no, plan_id: params.provider_plan_id || params.plan_id };
      break;
    default:
      throw new Error('Invalid service type');
  }

  console.log(`[CDH] POST ${endpoint}`, JSON.stringify(apiBody));

  const res = await fetch(`${CDH_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(apiBody),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: 'Non-JSON response', detail: text.substring(0, 300) }; }
  console.log(`[CDH] status=${res.status}, ok=${res.ok}`, JSON.stringify(data).substring(0, 300));
  return { ok: res.ok, data };
}

async function callHadiData(
  apiKey: string,
  serviceType: string,
  params: Record<string, any>,
  amount: number
): Promise<{ ok: boolean; data: any }> {
  let endpoint = '';
  let apiBody: Record<string, any> = {};
  const hdNetwork = HD_NETWORK_MAP[params.provider_id] || HD_NETWORK_MAP[params.network_id] || 1;

  switch (serviceType) {
    case 'airtime':
      endpoint = '/airtime/';
      apiBody = { network: hdNetwork, amount, mobile_number: params.phone_number, Ported_number: true, airtime_type: 'VTU' };
      break;
    case 'data':
      endpoint = '/data/';
      apiBody = { network: hdNetwork, mobile_number: params.phone_number, plan: Number(params.provider_plan_id || params.bundle_id), Ported_number: true };
      break;
    case 'electricity':
      endpoint = '/electricity/';
      apiBody = { disco_name: params.disco, amount, meter_number: params.meter_no, MeterType: params.meter_type === 'prepaid' ? 1 : 2 };
      break;
    case 'cable':
      endpoint = '/cable/';
      apiBody = { cablename: params.cable_name_id || 1, cableplan: Number(params.provider_plan_id || params.plan_id), smart_card_number: params.smartcard_no };
      break;
    default:
      throw new Error('Invalid service type');
  }

  console.log(`[HD] POST ${endpoint}`, JSON.stringify(apiBody));

  const res = await fetch(`${HD_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(apiBody),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: 'Non-JSON response', detail: text.substring(0, 300) }; }
  const isSuccess = res.ok && (data.status === 'successful' || data.Status === 'successful');
  console.log(`[HD] status=${res.status}, isSuccess=${isSuccess}`, JSON.stringify(data).substring(0, 300));
  return { ok: isSuccess, data };
}

// ─── Provider registry ───
type ProviderFn = (apiKey: string, serviceType: string, params: Record<string, any>, amount: number) => Promise<{ ok: boolean; data: any }>;

interface ProviderConfig {
  name: string;
  envKey: string;
  call: ProviderFn;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  hadidata:      { name: 'Hadi Data',    envKey: 'HADI_DATA_API',        call: callHadiData },
  cheapdatahub:  { name: 'CheapDataHub', envKey: 'CHEAPDATAHUB_API_KEY', call: callCheapDataHub },
};

const FALLBACK_ORDER = ['cheapdatahub', 'hadidata'];

// ─── Main handler ───
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization required');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    // ── Parse body ──
    const body = await req.json();
    const { service_type, amount, idempotency_key, provider_source, ...params } = body;

    console.log(`[PURCHASE] user=${user.id} type=${service_type} amount=${amount} source=${provider_source || 'auto'}`);

    if (!service_type || !amount || amount <= 0) {
      return json({ error: 'Invalid service_type or amount' }, 400);
    }

    // ── Fraud check ──
    const { data: fraudResult } = await supabaseAdmin.rpc('check_fraud', { p_user_id: user.id });
    if (fraudResult?.blocked) {
      return json({ error: fraudResult.reason || 'Account blocked' }, 403);
    }

    // ── Rate limit ──
    const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', {
      p_user_id: user.id, p_action: 'purchase', p_max_count: 5, p_window_seconds: 60,
    });
    if (!allowed) {
      return json({ error: 'Rate limit exceeded. Please wait before making another purchase.' }, 429);
    }

    // ── Wallet balance check (read-only) ──
    const { data: walletData } = await supabaseAdmin
      .from('wallets').select('balance').eq('user_id', user.id).single();

    if (!walletData || walletData.balance < amount) {
      return json({ error: 'Insufficient wallet balance' }, 402);
    }
    console.log(`[PURCHASE] Balance OK: ${walletData.balance} >= ${amount}`);

    // ── Build reference ──
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = idempotency_key || `YOMI-${dateStr}-${rand}`;

    // ── Record transaction as "initiated" (no wallet deduction yet) ──
    const requestedSource = provider_source || 'hadidata';
    await supabaseAdmin.from('service_transactions').insert({
      user_id: user.id,
      service_type,
      amount,
      reference,
      provider: requestedSource,
      phone_number: params.phone_number || '',
      status: 'initiated',
      metadata: { ...params, provider_source: requestedSource },
    });

    // ── Try providers with fallback ──
    const providerOrder = [requestedSource, ...FALLBACK_ORDER.filter(p => p !== requestedSource)];
    let result: { ok: boolean; data: any } | null = null;
    let usedProvider = '';
    let lastError = '';

    for (const providerKey of providerOrder) {
      const provider = PROVIDERS[providerKey];
      if (!provider) continue;

      const apiKey = Deno.env.get(provider.envKey);
      if (!apiKey) {
        console.log(`[PURCHASE] Skipping ${provider.name}: no API key configured`);
        continue;
      }

      try {
        console.log(`[PURCHASE] Trying ${provider.name}...`);
        result = await provider.call(apiKey, service_type, params, amount);
        usedProvider = providerKey;

        if (result.ok) {
          console.log(`[PURCHASE] ${provider.name} SUCCESS`);
          break;
        } else {
          lastError = result.data?.message || result.data?.api_response || result.data?.detail || `${provider.name} failed`;
          console.log(`[PURCHASE] ${provider.name} FAILED: ${lastError}`);
          result = null;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Provider error';
        console.error(`[PURCHASE] ${provider.name} EXCEPTION: ${lastError}`);
        result = null;
      }
    }

    // ── All providers failed → mark failed, do NOT deduct ──
    if (!result || !result.ok) {
      console.log(`[PURCHASE] ALL PROVIDERS FAILED – no wallet deduction`);
      await supabaseAdmin
        .from('service_transactions')
        .update({ status: 'failed', api_response: result?.data || { error: lastError } })
        .eq('reference', reference);

      return json({ error: lastError || 'All providers failed. Please try again later.' }, 502);
    }

    // ── Provider succeeded → NOW deduct wallet atomically ──
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc('deduct_wallet', {
      p_user_id: user.id, p_amount: amount, p_reference: reference,
    });

    if (deductError) {
      console.error(`[PURCHASE] Wallet deduction error after API success: ${deductError.message}`);
      // API succeeded but wallet deduction failed – mark as needs-attention
      await supabaseAdmin
        .from('service_transactions')
        .update({ status: 'completed_no_debit', api_response: result.data })
        .eq('reference', reference);

      return json({ error: 'Purchase completed but wallet update failed. Contact support.' }, 500);
    }

    if (deductResult?.status === 'duplicate') {
      return json({ success: true, duplicate: true, reference, message: 'Transaction already processed' }, 200);
    }

    if (deductResult?.status === 'error') {
      // Balance changed between check and deduction (race condition)
      await supabaseAdmin
        .from('service_transactions')
        .update({ status: 'completed_no_debit', api_response: result.data })
        .eq('reference', reference);

      return json({ error: deductResult.message || 'Wallet deduction failed after purchase' }, 500);
    }

    // ── Mark successful ──
    await supabaseAdmin
      .from('service_transactions')
      .update({
        status: 'successful',
        api_response: result.data,
        provider: `${usedProvider}:${params.provider_id || params.disco || params.plan_id || ''}`,
      })
      .eq('reference', reference);

    console.log(`[PURCHASE] COMPLETE via ${usedProvider}, ref=${reference}`);

    return json({ success: true, reference, provider: usedProvider, data: result.data }, 200);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PURCHASE] Error: ${message}`);
    return json({ error: message }, 400);
  }
});

// ── Helper ──
function json(body: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
