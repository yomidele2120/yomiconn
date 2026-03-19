import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY is not configured');

    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    // Verify webhook signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(PAYSTACK_SECRET_KEY),
      { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const hash = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== signature) {
      console.error('Invalid webhook signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Log webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'paystack',
      event_type: event.event,
      payload: event,
    });

    if (event.event === 'charge.success') {
      const { reference } = event.data;

      // Verify with Paystack
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || verifyData.data?.status !== 'success') {
        console.error('Payment verification failed:', verifyData);
        return new Response('Verification failed', { status: 400 });
      }

      // Find payment session by reference
      const { data: session } = await supabaseAdmin
        .from('payment_sessions')
        .select('*')
        .eq('reference', reference)
        .single();

      if (!session) {
        console.error('Payment session not found for reference:', reference);
        return new Response('Session not found', { status: 404 });
      }

      if (session.status === 'completed') {
        console.log('Already processed:', reference);
        return new Response('Already processed', { status: 200 });
      }

      const userId = session.user_id;
      // CRITICAL: Use session.amount (the wallet credit amount), NOT the Paystack amount
      // Paystack amount includes fees, session.amount is what the user should receive
      const creditAmount = session.amount;

      // Use safe credit function to prevent duplicates
      const { data: creditResult } = await supabaseAdmin.rpc('credit_wallet_safe', {
        p_user_id: userId,
        p_amount: creditAmount,
        p_reference: reference,
      });

      if (creditResult?.status === 'duplicate') {
        console.log('Already credited, skipping:', reference);
      }

      // Update payment session
      await supabaseAdmin
        .from('payment_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);

      console.log(`Webhook: credited ₦${creditAmount} for ref ${reference} (user ${userId})`);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Server error', { status: 500 });
  }
});
