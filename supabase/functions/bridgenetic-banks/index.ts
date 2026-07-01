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

async function headersFor(mode: BridgeneticAuthMode, body = "") {
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (mode === "hmac") {
    headers["X-Api-Key"] = API_KEY;
    headers["X-Signature"] = await hmac(body);
    return headers;
  }
  headers["Authorization"] = `Bearer ${mode === "bearer-token" ? BEARER_TOKEN : API_KEY}`;
  return headers;
}

async function callBridgenetic(path: string) {
  const attempts: BridgeneticAuthMode[] = [];
  if (SECRET) attempts.push("hmac");
  if (BEARER_TOKEN) attempts.push("bearer-token");
  attempts.push("bearer-api-key");

  let lastJson: any = null;
  let lastStatus = 500;
  for (const mode of attempts) {
    const res = await fetch(`${BASE}${path}`, { headers: await headersFor(mode, "") });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (res.ok && json.status !== false && json.success !== false) return { ok: true, status: res.status, json, mode };
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
    const result = await callBridgenetic("/banks");
    if (!result.ok) {
      const msg = result.json?.error?.message || result.json?.message || "Failed to load banks";
      console.error("Bridgenetic banks failed", { status: result.status, message: msg, authMode: result.mode });
      return jsonResponse({
        status: "error",
        error: String(msg).toLowerCase().includes("unauthenticated")
          ? "Bridgenetic rejected the saved API credentials. Please update the Bridgenetic API key pair/token in backend secrets."
          : msg,
        details: result.json,
      });
    }
    return jsonResponse(result.json);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
