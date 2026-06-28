import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://bridgenetic.com/api/v1";
const API_KEY = Deno.env.get("BRIDGENETIC_API_KEY")!;
const SECRET = Deno.env.get("BRIDGENETIC_SECRET_KEY") || "";
const BEARER_TOKEN = Deno.env.get("BRIDGENETIC_BEARER_TOKEN") || "";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmac(body: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

type BridgeneticAuthMode = "hmac" | "bearer-token" | "bearer-api-key";

async function headersFor(mode: BridgeneticAuthMode, body: string, idempotencyKey: string) {
  const headers: Record<string, string> = {
    "X-Idempotency-Key": idempotencyKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (mode === "hmac") {
    headers["X-Api-Key"] = API_KEY;
    headers["X-Signature"] = await hmac(body);
    return headers;
  }
  headers["Authorization"] = `Bearer ${mode === "bearer-token" ? BEARER_TOKEN : API_KEY}`;
  return headers;
}

async function callBridgeneticWithdrawal(body: string, reference: string) {
  const attempts: BridgeneticAuthMode[] = [];
  if (SECRET) attempts.push("hmac");
  if (BEARER_TOKEN) attempts.push("bearer-token");
  attempts.push("bearer-api-key");

  let lastJson: any = null;
  let lastStatus = 500;
  for (const mode of attempts) {
    const res = await fetch(`${BASE}/withdrawals/create`, { method: "POST", headers: await headersFor(mode, body, reference), body });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (res.ok && json?.success !== false && json?.status !== false) return { ok: true, status: res.status, json, mode };
    lastJson = json;
    lastStatus = res.status;
    const message = String(json?.error?.message || json?.message || "").toLowerCase();
    if (res.status !== 401 && !message.includes("unauthenticated")) break;
  }
  return { ok: false, status: lastStatus, json: lastJson, mode: attempts[attempts.length - 1] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claims.claims.sub;

    const { amount, bank_code, bank_name, account_number, account_name } = await req.json();
    const amt = Number(amount);
    if (!amt || amt < 1000) return jsonResponse({ error: "Minimum withdrawal is ₦1,000" }, 400);
    if (!bank_code || !bank_name || !account_number || !account_name) {
      return jsonResponse({ error: "Missing bank details" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const reference = `WDR-${userId.slice(0,8)}-${Date.now()}`;

    // Deduct from user's Yomiconnect wallet first (atomic)
    const { data: deduct, error: deductErr } = await admin.rpc("deduct_wallet", {
      p_user_id: userId, p_amount: amt, p_reference: reference,
    });
    if (deductErr || (deduct as any)?.status === "error") {
      return jsonResponse({ error: (deduct as any)?.message || deductErr?.message || "Wallet deduction failed" }, 400);
    }

    // Call Bridgenetics withdrawal
    const payload = { amount: amt, bank_code, bank_name, account_number, account_name };
    const body = JSON.stringify(payload);

    let providerJson: any;
    try {
      const result = await callBridgeneticWithdrawal(body, reference);
      providerJson = result.json;
      if (!result.ok) {
        const msg = providerJson?.error?.message || providerJson?.message || "Provider rejected withdrawal";
        console.error("Bridgenetic withdrawal failed", { status: result.status, message: msg, authMode: result.mode });
        throw new Error(String(msg).toLowerCase().includes("unauthenticated")
          ? "Bridgenetic rejected the saved API credentials. Please update the Bridgenetic API key pair/token in backend secrets."
          : msg);
      }
    } catch (providerErr) {
      // Refund the user
      await admin.rpc("refund_wallet", { p_user_id: userId, p_amount: amt, p_reference: reference });
      return jsonResponse({ error: (providerErr as Error).message, refunded: true }, 400);
    }

    return jsonResponse({ status: "success", reference, data: providerJson.data });
  } catch (e) {
    console.error("withdraw error", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
