import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://bridgenetic.com/api/v1";
const API_KEY = Deno.env.get("BRIDGENETIC_API_KEY")!;
const SECRET = Deno.env.get("BRIDGENETIC_SECRET_KEY") || "";

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

function sanitizeNarration(name: string) {
  let n = (name || "").replace(/[^a-zA-Z0-9\s\-']/g, "").trim();
  if (n.length < 3) n = (n + " User").trim();
  return n.slice(0, 50);
}

type BridgeneticAuthMode = "hmac" | "bearer";

async function bridgeneticHeaders(body: string, mode: BridgeneticAuthMode, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;

  if (mode === "hmac") {
    headers["X-Api-Key"] = API_KEY;
    headers["X-Signature"] = await hmac(body);
    return headers;
  }

  headers["Authorization"] = `Bearer ${API_KEY}`;
  return headers;
}

async function callBridgeneticVirtualAccount(body: string, idempotencyKey: string) {
  const attempts: BridgeneticAuthMode[] = SECRET ? ["hmac", "bearer"] : ["bearer"];
  let lastJson: any = null;
  let lastStatus = 500;

  for (const mode of attempts) {
    const headers = await bridgeneticHeaders(body, mode, idempotencyKey);
    const res = await fetch(`${BASE}/virtual-accounts/create`, { method: "POST", headers, body });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};

    if (res.ok && json.status !== false && json.success !== false) {
      return { ok: true, status: res.status, json, mode };
    }

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await admin.from("profiles").select("*").eq("user_id", userId).single();
    if (!profile) return jsonResponse({ error: "Profile not found" }, 404);

    if (profile.bn_account_number) {
      return jsonResponse({
        status: "exists",
        data: { account_number: profile.bn_account_number, bank_name: profile.bn_bank_name, account_name: profile.bn_account_name },
      });
    }

    const fullName = profile.full_name || (profile.email ? profile.email.split("@")[0] : "User");
    const phone = profile.phone || "08000000000";
    const payload = {
      customer_name: fullName,
      email: profile.email,
      phone,
      narration: sanitizeNarration(fullName),
    };
    const body = JSON.stringify(payload);
    const provider = await callBridgeneticVirtualAccount(body, `VA-${userId}-${Date.now()}`);
    const json = provider.json;
    if (!provider.ok) {
      const msg = json?.error?.message || json?.message || "Failed to create virtual account";
      console.error("Bridgenetic create VA failed", { status: provider.status, message: msg, authMode: provider.mode });
      const friendly = msg.toLowerCase().includes("unauthenticated")
        ? "Bridgenetic rejected the saved API credentials. Please update the Bridgenetic API key pair/token in backend secrets."
        : msg;
      return jsonResponse({ status: "error", error: friendly, details: json });
    }
    const d = json.data || {};
    await admin.from("profiles").update({
      bn_account_number: d.account_number,
      bn_account_name: d.account_name,
      bn_bank_name: d.bank_name,
      bn_va_id: d.id ?? null,
      bn_created_at: new Date().toISOString(),
    }).eq("user_id", userId);

    return jsonResponse({ status: "success", data: d });
  } catch (e) {
    console.error("create-va error", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
