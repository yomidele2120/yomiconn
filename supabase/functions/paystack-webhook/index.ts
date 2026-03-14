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
      const { reference, amount } = event.data;
      const amountNaira = amount / 100;

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

      // Check for duplicate wallet transaction
      const { data: existing } = await supabaseAdmin
        .from('wallet_transactions')
        .select('id')
        .eq('reference', reference)
        .single();

      if (!existing) {
        // Credit wallet atomically
        const { error: walletError } = await supabaseAdmin.rpc('credit_wallet', {
          p_user_id: userId,
          p_amount: amountNaira,
        });

        if (walletError) {
          // Fallback
          await supabaseAdmin
            .from('wallets')
            .update({ balance: (session.amount || 0) + amountNaira })
            .eq('user_id', userId);
        }

        // Record transaction
        await supabaseAdmin.from('wallet_transactions').insert({
          user_id: userId,
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
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Server error', { status: 500 });
  }
});
