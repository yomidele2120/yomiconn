import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api/v1/resellers';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CDH_API_KEY = Deno.env.get('CHEAPDATAHUB_API_KEY');
    if (!CDH_API_KEY) {
      throw new Error('CHEAPDATAHUB_API_KEY is not configured');
    }

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

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
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const { service_type, amount, ...params } = body;

    // Check wallet balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    // Generate reference
    const reference = `YC-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Record service transaction as initiated
    await supabaseAdmin.from('service_transactions').insert({
      user_id: user.id,
      service_type,
      amount,
      reference,
      provider: params.provider_id || params.disco || params.plan_id || '',
      phone_number: params.phone_number || '',
      status: 'initiated',
      metadata: params,
    });

    // Deduct from wallet
    await supabaseAdmin
      .from('wallets')
      .update({ balance: wallet.balance - amount })
      .eq('user_id', user.id);

    // Record wallet debit
    await supabaseAdmin.from('wallet_transactions').insert({
      user_id: user.id,
      type: 'debit',
      amount,
      reference,
      description: `${service_type} purchase`,
      status: 'successful',
    });

    // Call CheapDataHub API
    let endpoint = '';
    let apiBody: Record<string, any> = {};

    switch (service_type) {
      case 'airtime':
        endpoint = '/airtime/purchase/';
        apiBody = {
          provider_id: params.provider_id,
          phone_number: params.phone_number,
          amount,
        };
        break;
      case 'data':
        endpoint = '/data/purchase/';
        apiBody = {
          bundle_id: params.bundle_id,
          phone_number: params.phone_number,
        };
        break;
      case 'electricity':
        endpoint = '/electricity/purchase/';
        apiBody = {
          disco: params.disco,
          meter_no: params.meter_no,
          amount,
          phone_number: params.phone_number,
          meter_type: params.meter_type,
        };
        break;
      case 'cable':
        endpoint = '/cable/purchase/';
        apiBody = {
          smartcard_no: params.smartcard_no,
          plan_id: params.plan_id,
        };
        break;
      default:
        throw new Error('Invalid service type');
    }

    const cdhResponse = await fetch(`${CDH_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CDH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiBody),
    });

    const cdhData = await cdhResponse.json();

    let status = 'processing';
    if (cdhResponse.ok) {
      status = 'successful';
    } else {
      status = 'failed';
      // Refund on failure
      await supabaseAdmin
        .from('wallets')
        .update({ balance: wallet.balance })
        .eq('user_id', user.id);

      await supabaseAdmin
        .from('wallet_transactions')
        .update({ status: 'refunded' })
        .eq('reference', reference);
    }

    // Update service transaction status
    await supabaseAdmin
      .from('service_transactions')
      .update({
        status,
        api_response: cdhData,
      })
      .eq('reference', reference);

    if (!cdhResponse.ok) {
      const errorMsg = cdhData?.message || `API error: ${cdhResponse.status}`;
      throw new Error(errorMsg);
    }

    return new Response(JSON.stringify({
      success: true,
      reference,
      data: cdhData,
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
