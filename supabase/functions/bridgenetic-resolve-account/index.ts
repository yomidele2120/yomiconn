import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://bridgenetic.com/api/v1";
const API_KEY = Deno.env.get("BRIDGENETIC_API_KEY")!;
const SECRET = Deno.env.get("BRIDGENETIC_SECRET_KEY")!;

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
    const { account_number, bank_code } = await req.json();
    if (!account_number || !bank_code) {
      return new Response(JSON.stringify({ error: "account_number and bank_code required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = JSON.stringify({ account_number, bank_code });
    const sig = await hmac(body);
    const res = await fetch(`${BASE}/accounts/resolve`, {
      method: "POST",
      headers: { "X-Api-Key": API_KEY, "X-Signature": sig, "Content-Type": "application/json", "Accept": "application/json" },
      body,
    });
    const json = await res.json();
    return new Response(JSON.stringify(json), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
