import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

function json(body: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return json({ error: 'Missing X-API-Key header' }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate API key
    const { data: validation, error: valError } = await supabaseAdmin.rpc('validate_api_key', { p_api_key: apiKey });
    if (valError || !validation?.valid) {
      return json({ error: validation?.error || 'Invalid API key' }, 401);
    }

    const { partner_name, permissions, owner_id } = validation;

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return json({ error: 'Missing action field' }, 400);
    }

    // Check balance action
    if (action === 'check_balance') {
      const { data: wallet } = await supabaseAdmin
        .from('wallets').select('balance').eq('user_id', owner_id).single();
      return json({ success: true, balance: wallet?.balance || 0, partner: partner_name });
    }

    // Map actions to service types
    const actionMap: Record<string, string> = {
      buy_airtime: 'airtime',
      buy_data: 'data',
      buy_cable: 'cable',
      buy_electricity: 'electricity',
    };

    const serviceType = actionMap[action];
    if (!serviceType) {
      return json({ error: `Unknown action: ${action}. Valid actions: ${Object.keys(actionMap).join(', ')}, check_balance` }, 400);
    }

    // Check permission
    if (!permissions.includes(serviceType)) {
      return json({ error: `This API key does not have permission for ${serviceType}` }, 403);
    }

    // Build purchase payload
    let purchaseBody: Record<string, any> = { service_type: serviceType };

    switch (serviceType) {
      case 'airtime':
        if (!body.phone_number || !body.network_id || !body.amount) {
          return json({ error: 'Required: phone_number, network_id, amount' }, 400);
        }
        purchaseBody = { ...purchaseBody, amount: Number(body.amount), phone_number: body.phone_number, provider_id: String(body.network_id) };
        break;
      case 'data':
        if (!body.phone_number || !body.network_id || !body.plan_id) {
          return json({ error: 'Required: phone_number, network_id, plan_id' }, 400);
        }
        purchaseBody = { ...purchaseBody, amount: Number(body.amount || 0), phone_number: body.phone_number, provider_id: String(body.network_id), provider_plan_id: String(body.plan_id) };
        break;
      case 'cable':
        if (!body.smartcard_no || !body.plan_id) {
          return json({ error: 'Required: smartcard_no, plan_id' }, 400);
        }
        purchaseBody = { ...purchaseBody, amount: Number(body.amount || 0), smartcard_no: body.smartcard_no, provider_plan_id: String(body.plan_id) };
        break;
      case 'electricity':
        if (!body.meter_no || !body.disco || !body.amount) {
          return json({ error: 'Required: meter_no, disco, amount, meter_type (prepaid/postpaid)' }, 400);
        }
        purchaseBody = { ...purchaseBody, amount: Number(body.amount), meter_no: body.meter_no, disco: body.disco, meter_type: body.meter_type || 'prepaid', phone_number: body.phone_number || '' };
        break;
    }

    // For data purchases, we need to look up the amount from the plan
    // The purchase-service function handles this

    // Call the purchase-service function internally using the owner's wallet
    // We'll replicate the core purchase logic here using the admin client

    const { data: fraudResult } = await supabaseAdmin.rpc('check_fraud', { p_user_id: owner_id });
    if (fraudResult?.blocked) {
      return json({ error: 'Account blocked: ' + (fraudResult.reason || '') }, 403);
    }

    const { data: walletData } = await supabaseAdmin
      .from('wallets').select('balance').eq('user_id', owner_id).single();

    if (!walletData || walletData.balance < purchaseBody.amount) {
      return json({ error: 'Insufficient wallet balance', balance: walletData?.balance || 0 }, 402);
    }

    // Build reference
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `YKAPI-${dateStr}-${rand}`;

    // Record transaction
    await supabaseAdmin.from('service_transactions').insert({
      user_id: owner_id,
      service_type: serviceType,
      amount: purchaseBody.amount,
      reference,
      provider: 'cheapdatahub',
      phone_number: purchaseBody.phone_number || '',
      status: 'initiated',
      metadata: { ...purchaseBody, api_partner: partner_name, source: 'reseller_api' },
    });

    // Call the upstream provider (CheapDataHub)
    const cdhApiKey = Deno.env.get('CHEAPDATAHUB_API_KEY');
    if (!cdhApiKey) {
      await supabaseAdmin.from('service_transactions').update({ status: 'failed', api_response: { error: 'No provider API key' } }).eq('reference', reference);
      return json({ error: 'Service temporarily unavailable' }, 503);
    }

    const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api/v1/resellers';
    let endpoint = '';
    let apiBody: Record<string, any> = {};

    switch (serviceType) {
      case 'airtime':
        endpoint = '/airtime/purchase/';
        apiBody = { provider_id: purchaseBody.provider_id, phone_number: purchaseBody.phone_number, amount: purchaseBody.amount };
        break;
      case 'data':
        endpoint = '/data/purchase/';
        apiBody = { bundle_id: purchaseBody.provider_plan_id, phone_number: purchaseBody.phone_number };
        break;
      case 'electricity':
        endpoint = '/electricity/purchase/';
        apiBody = { disco: purchaseBody.disco, meter_no: purchaseBody.meter_no, amount: purchaseBody.amount, phone_number: purchaseBody.phone_number, meter_type: purchaseBody.meter_type };
        break;
      case 'cable':
        endpoint = '/cable/purchase/';
        apiBody = { smartcard_no: purchaseBody.smartcard_no, plan_id: purchaseBody.provider_plan_id };
        break;
    }

    const providerRes = await fetch(`${CDH_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cdhApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(apiBody),
    });

    const providerText = await providerRes.text();
    let providerData;
    try { providerData = JSON.parse(providerText); } catch { providerData = { message: providerText.substring(0, 300) }; }

    if (!providerRes.ok) {
      await supabaseAdmin.from('service_transactions').update({ status: 'failed', api_response: providerData }).eq('reference', reference);
      return json({ error: providerData?.message || 'Provider error', reference }, 502);
    }

    // Deduct wallet
    const { data: deductResult, error: deductError } = await supabaseAdmin.rpc('deduct_wallet', {
      p_user_id: owner_id, p_amount: purchaseBody.amount, p_reference: reference,
    });

    if (deductError || deductResult?.status === 'error') {
      await supabaseAdmin.from('service_transactions').update({ status: 'completed_no_debit', api_response: providerData }).eq('reference', reference);
      return json({ error: 'Purchase completed but wallet deduction failed. Contact support.', reference }, 500);
    }

    // Mark successful
    await supabaseAdmin.from('service_transactions').update({
      status: 'successful',
      api_response: providerData,
      provider: `cheapdatahub:reseller_api`,
    }).eq('reference', reference);

    return json({
      success: true,
      reference,
      message: `${serviceType} purchase successful`,
      data: providerData,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[RESELLER-API] Error: ${message}`);
    return json({ error: message }, 400);
  }
});
