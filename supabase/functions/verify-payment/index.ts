import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY is not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { reference } = await req.json();
    if (!reference) throw new Error('Reference is required');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get payment session
    const { data: session } = await supabaseAdmin
      .from('payment_sessions')
      .select('*')
      .eq('reference', reference)
      .eq('user_id', user.id)
      .single();

    if (!session) {
      return new Response(JSON.stringify({ error: 'Payment session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Already completed
    if (session.status === 'completed') {
      return new Response(JSON.stringify({ status: 'completed', amount: session.amount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if expired
    if (new Date(session.expires_at) < new Date() && session.status !== 'completed') {
      await supabaseAdmin
        .from('payment_sessions')
        .update({ status: 'expired' })
        .eq('id', session.id);
      return new Response(JSON.stringify({ status: 'expired' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const verifyData = await verifyRes.json();

    if (verifyRes.ok && verifyData.data?.status === 'success') {
      const amountNaira = verifyData.data.amount / 100;

      // Check if already credited (idempotency)
      const { data: existing } = await supabaseAdmin
        .from('wallet_transactions')
        .select('id')
        .eq('reference', reference)
        .single();

      if (!existing) {
        // Credit wallet atomically
        await supabaseAdmin.rpc('credit_wallet', {
          p_user_id: user.id,
          p_amount: amountNaira,
        });

        // Record wallet transaction
        await supabaseAdmin.from('wallet_transactions').insert({
          user_id: user.id,
          type: 'credit',
          amount: amountNaira,
          reference,
          description: 'Wallet funded via Paystack',
          status: 'successful',
          metadata: { paystack_reference: reference },
        });
      }

      // Update payment session
      await supabaseAdmin
        .from('payment_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);

      return new Response(JSON.stringify({ status: 'completed', amount: amountNaira }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Still pending
    return new Response(JSON.stringify({ status: session.status }), {
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
