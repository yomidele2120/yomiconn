import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api/v1/resellers';
const ELRUFAI_BASE_URL = Deno.env.get('ELRUFAI_BASE_URL') || 'https://elrufaidatalink.com/api';

// Network mapping: our frontend IDs → Provider 2 network IDs
// Ours: 1=MTN, 2=Airtel, 3=Glo, 4=9mobile
// Provider 2: 1=MTN, 2=GLO, 3=9Mobile, 4=Airtel
const ELRUFAI_NETWORK_MAP: Record<string, number> = {
  '1': 1,
  '2': 4,
  '3': 2,
  '4': 3,
};

type ProviderResult = { ok: boolean; pending?: boolean; providerRef?: string | null; data: any; message?: string };

function toProviderNumber(value: unknown): number | string {
  const text = String(value ?? '').trim();
  if (!text) return text;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : text;
}

function extractProviderMessage(data: any, fallback = 'Provider request failed'): string {
  return String(
    data?.message ??
    data?.api_response ??
    data?.detail ??
    data?.error ??
    data?.data?.message ??
    data?.data?.error ??
    fallback
  );
}

function evaluateProviderResponse(res: Response, data: any): ProviderResult {
  const rawStatusVal = data?.status ?? data?.Status ?? data?.transaction_status ?? data?.data?.status ?? data?.data?.Status;
  const rawStatus = String(rawStatusVal ?? '').toLowerCase();
  const message = extractProviderMessage(data, `HTTP ${res.status}`).toLowerCase();
  const successWords = /(success|successful|delivered|completed|approved)/;
  const pendingWords = /(pending|processing|initiated|queued|in_progress)/;
  const failWords = /(fail|failed|error|invalid|insufficient|declined|rejected|low|does not exist|not found)/;

  let isSuccess = res.ok && (
    rawStatusVal === true ||
    data?.error === false ||
    ['success', 'successful', 'completed', 'delivered', 'true', 'ok', 'approved'].includes(rawStatus)
  );
  let isPending = res.ok && ['pending', 'processing', 'initiated', 'queued', 'in_progress'].includes(rawStatus);

  if (!isSuccess && !isPending && res.ok && message && successWords.test(message) && !failWords.test(message)) {
    isSuccess = true;
  }
  if (!isSuccess && !isPending && res.ok && message && pendingWords.test(message) && !failWords.test(message)) {
    isPending = true;
  }

  const providerRef = data?.transaction_id ?? data?.reference ?? data?.data?.transaction_id ?? data?.data?.reference ?? data?.id ?? null;
  return { ok: isSuccess, pending: isPending, providerRef, data, message: extractProviderMessage(data, `HTTP ${res.status}`) };
}

function shouldTryAlternateDataPayload(message: string): boolean {
  return /(plan|bundle|network|field|required|invalid|does not exist|not found|purchase failed)/i.test(message);
}

// ─── Provider API helpers ───

async function callCheapDataHub(
  apiKey: string,
  serviceType: string,
  params: Record<string, any>,
  amount: number
): Promise<ProviderResult> {
  let endpoint = '';
  let payloads: Record<string, any>[] = [];

  switch (serviceType) {
    case 'airtime':
      endpoint = '/airtime/purchase/';
      payloads = [{ provider_id: toProviderNumber(params.provider_id), phone_number: params.phone_number, amount }];
      break;
    case 'data':
      endpoint = '/data/purchase/';
      {
        const planId = params.provider_plan_id || params.bundle_id || params.plan_id;
        const networkId = params.provider_id || params.network_id;
        payloads = [
          { bundle_id: toProviderNumber(planId), phone_number: params.phone_number },
          { plan_id: toProviderNumber(planId), phone_number: params.phone_number },
          { plan_id: String(planId), phone: params.phone_number },
          { bundle_id: toProviderNumber(planId), phone_number: params.phone_number, provider_id: toProviderNumber(networkId) },
        ];
      }
      break;
    case 'electricity':
      endpoint = '/electricity/purchase/';
      payloads = [{ disco: params.disco, meter_no: params.meter_no, amount, phone_number: params.phone_number, meter_type: params.meter_type }];
      break;
    case 'cable':
      endpoint = '/cable/purchase/';
      payloads = [{ smartcard_no: params.smartcard_no, plan_id: toProviderNumber(params.provider_plan_id || params.plan_id) }];
      break;
    default:
      throw new Error('Invalid service type');
  }

  let lastResult: ProviderResult | null = null;
  for (let i = 0; i < payloads.length; i++) {
    const apiBody = payloads[i];
    console.log(`[CDH] POST ${endpoint} attempt=${i + 1}`, JSON.stringify(apiBody));

    const res = await fetch(`${CDH_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(apiBody),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: 'Non-JSON response', detail: text.substring(0, 300) }; }

    const evaluated = evaluateProviderResponse(res, data);
    lastResult = evaluated;
    console.log(`[CDH] http=${res.status} msg="${String(evaluated.message || '').substring(0, 80)}" success=${evaluated.ok} pending=${!!evaluated.pending}`);

    if (evaluated.ok || evaluated.pending || serviceType !== 'data' || !shouldTryAlternateDataPayload(evaluated.message || '')) {
      return evaluated;
    }
  }

  return lastResult || { ok: false, data: { error: 'Provider request failed' }, message: 'Provider request failed' };
}

async function callElRufaiDataSub(
  apiKey: string,
  serviceType: string,
  params: Record<string, any>,
  amount: number
): Promise<ProviderResult> {
  let endpoint = '';
  let payloads: Record<string, any>[] = [];
  const elrufaiNetwork = ELRUFAI_NETWORK_MAP[params.provider_id] || ELRUFAI_NETWORK_MAP[params.network_id] || 1;

  switch (serviceType) {
    case 'airtime':
      endpoint = '/airtime/';
      payloads = [{ network: elrufaiNetwork, amount, mobile_number: params.phone_number, Ported_number: true, airtime_type: 'VTU' }];
      break;
    case 'data':
      endpoint = '/data/';
      {
        const planId = params.provider_plan_id || params.bundle_id || params.plan_id;
        payloads = [
          { network: elrufaiNetwork, mobile_number: params.phone_number, plan: toProviderNumber(planId), Ported_number: true },
          { network: elrufaiNetwork, mobile_number: params.phone_number, data_plan: toProviderNumber(planId), Ported_number: true },
          { network: elrufaiNetwork, phone_number: params.phone_number, plan_id: toProviderNumber(planId), Ported_number: true },
        ];
      }
      break;
    case 'electricity':
      endpoint = '/electricity/';
      payloads = [{ disco_name: params.disco, amount, meter_number: params.meter_no, MeterType: params.meter_type === 'prepaid' ? 1 : 2 }];
      break;
    case 'cable':
      endpoint = '/cable/';
      payloads = [{ cablename: params.cable_name_id || 1, cableplan: toProviderNumber(params.provider_plan_id || params.plan_id), smart_card_number: params.smartcard_no }];
      break;
    default:
      throw new Error('Invalid service type');
  }

  let lastResult: ProviderResult | null = null;
  for (let i = 0; i < payloads.length; i++) {
    const apiBody = payloads[i];
    console.log(`[ELRUFAI] POST ${endpoint} attempt=${i + 1}`, JSON.stringify(apiBody));

    const res = await fetch(`${ELRUFAI_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(apiBody),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: 'Non-JSON response', detail: text.substring(0, 300) }; }
    const evaluated = evaluateProviderResponse(res, data);
    lastResult = evaluated;
    console.log(`[ELRUFAI] status=${res.status}, success=${evaluated.ok}, pending=${!!evaluated.pending}`, JSON.stringify(data).substring(0, 300));

    if (evaluated.ok || evaluated.pending || serviceType !== 'data' || !shouldTryAlternateDataPayload(evaluated.message || '')) {
      return evaluated;
    }
  }

  return lastResult || { ok: false, data: { error: 'Provider request failed' }, message: 'Provider request failed' };
}

// ─── Provider registry ───
type ProviderFn = (apiKey: string, serviceType: string, params: Record<string, any>, amount: number) => Promise<ProviderResult>;

interface ProviderConfig {
  name: string;
  envKeys: string[];
  call: ProviderFn;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  cheapdatahub:    { name: 'CheapDataHub',    envKeys: ['CHEAPDATAHUH_API_KEY'], call: callCheapDataHub },
  elrufaidatalink: { name: 'ElRufaiDataSub', envKeys: ['ELRUFAIDATALINK_API_KEY', 'ELRUFAI_API_KEY'], call: callElRufaiDataSub },
  // Aliases
  elrufai:         { name: 'ElRufaiDataSub', envKeys: ['ELRUFAIDATALINK_API_KEY', 'ELRUFAI_API_KEY'], call: callElRufaiDataSub },
};

// Try the other configured provider when the chosen one rejects a purchase.
const FALLBACK_ORDER = ['cheapdatahub', 'elrufaidatalink'];

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
    const requestedSource = provider_source || 'cheapdatahub';
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
    let result: ProviderResult | null = null;
    let usedProvider = '';
    let lastError = '';

    for (const providerKey of providerOrder) {
      const provider = PROVIDERS[providerKey];
      if (!provider) continue;

      const apiKey = provider.envKeys.map((key) => Deno.env.get(key)).find(Boolean);
      if (!apiKey) {
        console.log(`[PURCHASE] Skipping ${provider.name}: no API key configured (${provider.envKeys.join(', ')})`);
        continue;
      }

      try {
        console.log(`[PURCHASE] Trying ${provider.name}...`);
        result = await provider.call(apiKey, service_type, params, amount);
        usedProvider = providerKey;

        if (result.ok || result.pending) {
          console.log(`[PURCHASE] ${provider.name} ${result.ok ? 'SUCCESS' : 'PENDING'}`);
          break;
        } else {
          lastError = result.message || result.data?.message || result.data?.api_response || result.data?.detail || `${provider.name} failed`;
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
    if (!result || (!result.ok && !result.pending)) {
      console.log(`[PURCHASE] ALL PROVIDERS FAILED – no wallet deduction`);
      await supabaseAdmin.rpc('settle_service_transaction_failure', {
        p_reference: reference,
        p_reason: lastError || 'All providers failed',
        p_api_response: result?.data || { error: lastError },
      });
      return json({ error: lastError || 'All providers failed. Please try again later.' }, 502);
    }

    // ── Async pending → keep open, webhook will settle ──
    if (result.pending && !result.ok) {
      await supabaseAdmin
        .from('service_transactions')
        .update({
          status: 'pending',
          api_response: result.data,
          provider_reference: result.providerRef,
          provider: `${usedProvider}:${params.provider_id || params.disco || params.plan_id || ''}`,
        })
        .eq('reference', reference);

      console.log(`[PURCHASE] PENDING via ${usedProvider}, awaiting webhook for ${reference}`);
      return json({ success: true, pending: true, reference, provider: usedProvider, data: result.data }, 200);
    }

    // ── Immediate success → settle atomically (deduct wallet + mark success) ──
    const { data: settleResult, error: settleError } = await supabaseAdmin.rpc(
      'settle_service_transaction_success',
      {
        p_reference: reference,
        p_provider_reference: result.providerRef,
        p_api_response: result.data,
      }
    );

    if (settleError) {
      console.error(`[PURCHASE] Settlement error: ${settleError.message}`);
      return json({ error: 'Purchase completed but wallet update failed. Contact support.' }, 500);
    }

    if (settleResult?.status === 'no_debit') {
      return json({ error: 'Purchase delivered but wallet had insufficient balance. Contact support.' }, 500);
    }

    await supabaseAdmin
      .from('service_transactions')
      .update({ provider: `${usedProvider}:${params.provider_id || params.disco || params.plan_id || ''}` })
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
