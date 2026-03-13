import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

serve(async (req) => {
  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    // Verify webhook signature
    const hash = hmac('sha512', PAYSTACK_SECRET_KEY, body).hex();
    if (hash !== signature) {
      console.error('Invalid webhook signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Log the webhook
    await supabaseAdmin.from('webhook_logs').insert({
      source: 'paystack',
      event_type: event.event,
      payload: event,
    });

    if (event.event === 'charge.success') {
      const { reference, amount, customer } = event.data;
      const amountNaira = amount / 100;

      // Verify the transaction with Paystack
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || verifyData.data?.status !== 'success') {
        console.error('Payment verification failed:', verifyData);
        return new Response('Verification failed', { status: 400 });
      }

      // Find user by email
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('email', customer.email)
        .single();

      if (!profiles?.user_id) {
        console.error('User not found for email:', customer.email);
        return new Response('User not found', { status: 404 });
      }

      const userId = profiles.user_id;

      // Check for duplicate reference
      const { data: existing } = await supabaseAdmin
        .from('wallet_transactions')
        .select('id')
        .eq('reference', reference)
        .single();

      if (existing) {
        console.log('Duplicate webhook for reference:', reference);
        return new Response('Already processed', { status: 200 });
      }

      // Credit wallet (atomic operation)
      const { error: walletError } = await supabaseAdmin.rpc('credit_wallet', {
        p_user_id: userId,
        p_amount: amountNaira,
      });

      // If RPC doesn't exist yet, fallback to direct update
      if (walletError) {
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('balance')
          .eq('user_id', userId)
          .single();

        await supabaseAdmin
          .from('wallets')
          .update({ balance: (wallet?.balance || 0) + amountNaira })
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

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Server error', { status: 500 });
  }
});
