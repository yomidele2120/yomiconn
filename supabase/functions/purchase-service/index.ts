import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api/v1/resellers';
const BD_BASE_URL = 'https://blessdata.com.ng/api';

// ─── Provider API call helpers ───

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
      apiBody = { bundle_id: params.bundle_id, phone_number: params.phone_number };
      break;
    case 'electricity':
      endpoint = '/electricity/purchase/';
      apiBody = { disco: params.disco, meter_no: params.meter_no, amount, phone_number: params.phone_number, meter_type: params.meter_type };
      break;
    case 'cable':
      endpoint = '/cable/purchase/';
      apiBody = { smartcard_no: params.smartcard_no, plan_id: params.plan_id };
      break;
    default:
      throw new Error('Invalid service type');
  }

  const res = await fetch(`${CDH_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apiBody),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: 'Non-JSON response' }; }
  return { ok: res.ok, data };
}

// BlessData network mapping: 1=MTN, 2=GLO, 3=9mobile, 4=Airtel
const BD_NETWORK_MAP: Record<string, number> = {
  '1': 1, // MTN → 1
  '2': 4, // Airtel → 4 (our ID 2 = Airtel)
  '3': 2, // Glo → 2
  '4': 3, // 9mobile → 3
};

async function callBlessData(
  apiKey: string,
  serviceType: string,
  params: Record<string, any>,
  amount: number,
  reference: string
): Promise<{ ok: boolean; data: any }> {
  let endpoint = '';
  let apiBody: Record<string, any> = {};

  const bdNetwork = BD_NETWORK_MAP[params.provider_id] || BD_NETWORK_MAP[params.network_id] || 1;

  switch (serviceType) {
    case 'airtime':
      endpoint = '/airtime/';
      apiBody = {
        phone: params.phone_number,
        network: bdNetwork,
        amount,
        airtel_type: 'VTU',
        ref: reference,
      };
      break;
    case 'data':
      endpoint = '/data/';
      apiBody = {
        phone: params.phone_number,
        network: bdNetwork,
        data_plan: params.provider_plan_id || params.bundle_id,
        bypass: 0,
        ref: reference,
      };
      break;
    case 'electricity':
      endpoint = '/electricity/';
      apiBody = {
        phone: params.phone_number,
        meter_number: params.meter_no,
        disco: params.disco,
        amount,
        meter_type: params.meter_type,
        ref: reference,
      };
      break;
    case 'cable':
      endpoint = '/cabletv/';
      apiBody = {
        smart_card_number: params.smartcard_no,
        cable_plan: params.provider_plan_id || params.plan_id,
        ref: reference,
      };
      break;
    default:
      throw new Error('Invalid service type');
  }

  const res = await fetch(`${BD_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apiBody),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: 'Non-JSON response', detail: text.substring(0, 200) }; }

  // BlessData uses Status field
  const isSuccess = res.ok && (data.Status === 'successful' || data.status === 'successful');
  return { ok: isSuccess, data };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CDH_API_KEY = Deno.env.get('CHEAPDATAHUB_API_KEY');
    const BD_API_KEY = Deno.env.get('BLESSDATA_API_KEY');

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

    const body = await req.json();
    const { service_type, amount, idempotency_key, provider_source, ...params } = body;

    // Input validation
    if (!service_type || !amount || amount <= 0) {
      throw new Error('Invalid service_type or amount');
    }

    // Server-side balance check
    const { data: walletData } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    
    if (!walletData || walletData.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    // Verify transaction PIN was checked (PIN verification happens on frontend via manage-pin)
    // The atomic deduct_wallet below is the real guard

    // Determine which provider to use
    const source: string = provider_source || 'cheapdatahub';

    // Validate provider API key is available
    if (source === 'cheapdatahub' && !CDH_API_KEY) throw new Error('CheapDataHub API key not configured');
    if (source === 'blessdata' && !BD_API_KEY) throw new Error('BlessData API key not configured');

    // === FRAUD CHECK ===
    const { data: fraudResult } = await supabaseAdmin.rpc('check_fraud', { p_user_id: user.id });
    if (fraudResult?.blocked) {
      throw new Error(fraudResult.reason || 'Account blocked');
    }

    // === RATE LIMITING ===
    const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action: 'purchase',
      p_max_count: 5,
      p_window_seconds: 60,
    });
    if (!allowed) {
      throw new Error('Rate limit exceeded. Please wait before making another purchase.');
    }

    // === GENERATE UNIQUE REFERENCE ===
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const prefix = source === 'blessdata' ? 'BD' : 'CDH';
    const reference = idempotency_key || `YOMI-${prefix}-${dateStr}-${rand}`;

    // === ATOMIC WALLET DEDUCTION ===
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc('deduct_wallet', {
      p_user_id: user.id,
      p_amount: amount,
      p_reference: reference,
    });

    if (deductError) throw new Error(deductError.message);

    if (deductResult?.status === 'duplicate') {
      return new Response(JSON.stringify({
        success: true,
        duplicate: true,
        reference,
        message: 'Transaction already processed',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (deductResult?.status === 'error') {
      throw new Error(deductResult.message);
    }

    // === RECORD SERVICE TRANSACTION ===
    await supabaseAdmin.from('service_transactions').insert({
      user_id: user.id,
      service_type,
      amount,
      reference,
      provider: `${source}:${params.provider_id || params.disco || params.plan_id || ''}`,
      phone_number: params.phone_number || '',
      status: 'initiated',
      metadata: { ...params, provider_source: source },
    });

    // === CALL PROVIDER API ===
    let result: { ok: boolean; data: any };

    if (source === 'blessdata') {
      result = await callBlessData(BD_API_KEY!, service_type, params, amount, reference);
    } else {
      result = await callCheapDataHub(CDH_API_KEY!, service_type, params, amount);
    }

    let status = result.ok ? 'successful' : 'failed';

    if (!result.ok) {
      // Refund on failure
      await supabaseAdmin.rpc('refund_wallet', {
        p_user_id: user.id,
        p_amount: amount,
        p_reference: reference,
      });
    }

    // Update service transaction
    await supabaseAdmin
      .from('service_transactions')
      .update({ status, api_response: result.data })
      .eq('reference', reference);

    if (!result.ok) {
      const errorMsg = result.data?.message || result.data?.detail || `Provider error (${source})`;
      throw new Error(errorMsg);
    }

    return new Response(JSON.stringify({
      success: true,
      reference,
      data: result.data,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
