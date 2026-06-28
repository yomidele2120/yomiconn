import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://bridgenetic.com/api/v1";
const API_KEY = Deno.env.get("BRIDGENETIC_API_KEY")!;
const SECRET = Deno.env.get("BRIDGENETIC_SECRET_KEY") || "";

async function hmac(body: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub;

    const { amount, bank_code, bank_name, account_number, account_name } = await req.json();
    const amt = Number(amount);
    if (!amt || amt < 100) return new Response(JSON.stringify({ error: "Minimum withdrawal is ₦100" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!bank_code || !bank_name || !account_number || !account_name) {
      return new Response(JSON.stringify({ error: "Missing bank details" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const reference = `WDR-${userId.slice(0,8)}-${Date.now()}`;

    // Deduct from user's Yomiconnect wallet first (atomic)
    const { data: deduct, error: deductErr } = await admin.rpc("deduct_wallet", {
      p_user_id: userId, p_amount: amt, p_reference: reference,
    });
    if (deductErr || (deduct as any)?.status === "error") {
      return new Response(JSON.stringify({ error: (deduct as any)?.message || deductErr?.message || "Wallet deduction failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Call Bridgenetics withdrawal
    const payload = { amount: amt, bank_code, bank_name, account_number, account_name };
    const body = JSON.stringify(payload);
    const sig = await hmac(body);

    let providerJson: any;
    try {
      const res = await fetch(`${BASE}/withdrawals/create`, {
        method: "POST",
        headers: { "X-Api-Key": API_KEY, "X-Signature": sig, "X-Idempotency-Key": reference, "Content-Type": "application/json", "Accept": "application/json" },
        body,
      });
      providerJson = await res.json();
      if (!res.ok || providerJson?.success === false || providerJson?.status === false) {
        throw new Error(providerJson?.error?.message || providerJson?.message || "Provider rejected withdrawal");
      }
    } catch (providerErr) {
      // Refund the user
      await admin.rpc("refund_wallet", { p_user_id: userId, p_amount: amt, p_reference: reference });
      return new Response(JSON.stringify({ error: (providerErr as Error).message, refunded: true }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ status: "success", reference, data: providerJson.data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("withdraw error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
