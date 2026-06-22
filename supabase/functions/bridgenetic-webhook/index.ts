import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const WEBHOOK_SECRET = Deno.env.get("BRIDGENETIC_WEBHOOK_SECRET") || "";

async function verifyHmacSha512(body: string, signature: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true; // allow but log if secret not configured
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const raw = await req.text();
  const sig = req.headers.get("x-bridgenetic-signature") || "";

  if (WEBHOOK_SECRET && !(await verifyHmacSha512(raw, sig))) {
    console.warn("bridgenetic-webhook: invalid signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!WEBHOOK_SECRET) console.warn("bridgenetic-webhook: BRIDGENETIC_WEBHOOK_SECRET not set — accepting unverified");

  let event: any;
  try { event = JSON.parse(raw); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const evt = event?.event || "unknown";
  const data = event?.data || {};
  const reference = data?.reference || data?.session_id || `bn-${Date.now()}`;

  try {
    if (evt === "deposit.success") {
      const vaNumber = data?.virtual_account_number;
      const amount = Number(data?.net_amount ?? data?.amount ?? 0);

      if (!vaNumber || !amount) {
        console.error("deposit.success missing fields", data);
        return new Response(JSON.stringify({ received: true, ignored: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: profile } = await admin.from("profiles").select("user_id, full_name").eq("bn_account_number", vaNumber).maybeSingle();
      if (!profile) {
        console.warn("No user matched VA", vaNumber);
        await admin.from("bridgenetic_events").upsert({
          event: evt, reference, amount, payload: event, processed: false,
        }, { onConflict: "reference" });
        return new Response(JSON.stringify({ received: true, matched: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Credit Yomiconnect wallet (idempotent via reference)
      const { data: credit, error: cErr } = await admin.rpc("credit_wallet_safe", {
        p_user_id: profile.user_id, p_amount: amount, p_reference: `BN-${reference}`,
      });
      if (cErr) console.error("credit_wallet_safe error", cErr);

      await admin.from("bridgenetic_events").upsert({
        event: evt, reference, user_id: profile.user_id, amount, payload: event, processed: true,
      }, { onConflict: "reference" });

      return new Response(JSON.stringify({ received: true, credit }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Other events: just log
    await admin.from("bridgenetic_events").upsert({
      event: evt, reference, payload: event, processed: false,
    }, { onConflict: "reference" });

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("webhook error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
