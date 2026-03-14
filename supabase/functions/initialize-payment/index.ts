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
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user from JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { amount } = await req.json();

    if (!amount || amount < 100) {
      throw new Error('Minimum amount is ₦100');
    }

    // Generate unique reference
    const shortId = user.id.slice(0, 8);
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const reference = `YOMI-PAY-${shortId}-${timestamp}-${rand}`;

    // Create payment session in DB
    const { error: sessionError } = await supabaseAdmin
      .from('payment_sessions')
      .insert({
        user_id: user.id,
        reference,
        amount,
        status: 'pending',
      });

    if (sessionError) throw new Error('Failed to create payment session: ' + sessionError.message);

    // Initialize Paystack transaction
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100, // Paystack uses kobo
        email: user.email,
        reference,
        callback_url: `${req.headers.get('origin') || Deno.env.get('SITE_URL')}/payment-waiting?ref=${reference}`,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      // Clean up session
      await supabaseAdmin.from('payment_sessions').delete().eq('reference', reference);
      throw new Error(data.message || 'Failed to initialize payment');
    }

    // Update session with Paystack details
    await supabaseAdmin
      .from('payment_sessions')
      .update({
        paystack_reference: data.data.reference,
        authorization_url: data.data.authorization_url,
        status: 'waiting_for_payment',
      })
      .eq('reference', reference);

    return new Response(JSON.stringify({
      authorization_url: data.data.authorization_url,
      reference,
      paystack_reference: data.data.reference,
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
