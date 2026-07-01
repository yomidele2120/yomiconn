// CheapDataHub webhook receiver
// Public endpoint. If CHEAPDATAHUB_WEBHOOK_SECRET is configured, signature is REQUIRED (401 on mismatch).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cheapdatahub-signature, x-webhook-secret, x-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickReference(p: any): string | null {
  return (
    p?.reference ?? p?.transaction_reference ?? p?.client_reference ??
    p?.merchant_reference ?? p?.order_id ?? p?.request_id ??
    p?.data?.reference ?? p?.data?.transaction_reference ??
    p?.data?.client_reference ?? null
  );
}
function pickProviderRef(p: any): string | null {
  return (
    p?.provider_reference ?? p?.transaction_id ?? p?.api_reference ??
    p?.data?.provider_reference ?? p?.data?.transaction_id ??
    p?.data?.api_reference ?? null
  );
}

// Map provider status → app status
// initiated → pending, processing → processing, successful → success,
// failed → failed, refunded → refunded
type AppStatus = "pending" | "processing" | "success" | "failed" | "refunded" | "unknown";
function mapStatus(p: any): AppStatus {
  const raw = String(
    p?.status ?? p?.transaction_status ?? p?.data?.status ?? p?.event ?? ""
  ).toLowerCase().trim();
  if (["initiated", "queued"].includes(raw)) return "pending";
  if (["processing", "in_progress", "pending"].includes(raw)) return "processing";
  if (["successful", "success", "completed", "delivered", "paid"].includes(raw)) return "success";
  if (["failed", "failure", "error", "declined", "cancelled", "canceled"].includes(raw)) return "failed";
  if (["refunded", "reversed", "refund"].includes(raw)) return "refunded";
  return "unknown";
}

function pickReason(p: any): string | null {
  return p?.message ?? p?.reason ?? p?.error ?? p?.data?.message ?? p?.data?.reason ?? null;
}
function pickEventId(p: any, ref: string | null, status: string): string {
  return (
    p?.event_id ?? p?.id ?? p?.data?.event_id ?? p?.data?.id ??
    `${ref ?? "noref"}:${status}:${p?.timestamp ?? p?.data?.timestamp ?? Date.now()}`
  );
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const rawBody = await req.text();

  // ── Signature verification (401 on failure when secret is set) ──
  const sharedSecret = Deno.env.get("CHEAPDATAHUB_WEBHOOK_SECRET");
  const provided =
    req.headers.get("x-cheapdatahub-signature") ??
    req.headers.get("x-signature") ??
    req.headers.get("x-webhook-secret");

  if (sharedSecret) {
    if (!provided) {
      console.warn("[CDH-WEBHOOK] 401 missing signature header");
      await supabase.from("webhook_logs").insert({
        provider: "cheapdatahub", status: "rejected",
        payload: { reason: "missing signature" },
      }).then(() => {}, () => {});
      return json({ error: "Missing signature" }, 401);
    }
    // Accept either raw shared secret OR HMAC-SHA256(rawBody, secret) hex
    const hmac = await hmacSha256Hex(sharedSecret, rawBody);
    const ok = provided === sharedSecret || provided.toLowerCase() === hmac.toLowerCase();
    if (!ok) {
      console.warn("[CDH-WEBHOOK] 401 signature mismatch");
      return json({ error: "Invalid signature" }, 401);
    }
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  console.log("[CDH-WEBHOOK] payload:", rawBody.slice(0, 1000));

  const reference = pickReference(payload);
  const status = mapStatus(payload);
  const providerRef = pickProviderRef(payload);
  const reason = pickReason(payload);
  const eventId = pickEventId(payload, reference, status);

  // Log every request
  await supabase.from("webhook_logs").insert({
    provider: "cheapdatahub", status, reference, payload,
  }).then(() => {}, (e) => console.error("[CDH-WEBHOOK] log err", e));

  if (!reference) {
    console.error("[CDH-WEBHOOK] no reference in payload");
    return json({ error: "Missing transaction reference" }, 400);
  }

  // ── Idempotency: UNIQUE(event_id) blocks duplicate deliveries ──
  const { error: insertErr } = await supabase
    .from("cheapdatahub_webhook_events")
    .insert({ event_id: eventId, reference, status, payload });
  if (insertErr) {
    if (insertErr.code === "23505") {
      console.log(`[CDH-WEBHOOK] duplicate event ${eventId} — skipping`);
      return json({ ok: true, duplicate: true }, 200);
    }
    console.error("[CDH-WEBHOOK] event log error:", insertErr);
  }

  // ── Lookup transaction ──
  const { data: tx, error: txErr } = await supabase
    .from("service_transactions")
    .select("id, user_id, status, amount")
    .eq("reference", reference)
    .maybeSingle();

  if (txErr) {
    console.error("[CDH-WEBHOOK] lookup error:", txErr);
    return json({ error: "Lookup failed" }, 500);
  }
  if (!tx) {
    console.warn(`[CDH-WEBHOOK] reference ${reference} not found`);
    return json({ error: "Transaction not found" }, 404);
  }

  console.log(`[CDH-WEBHOOK] ref=${reference} current=${tx.status} incoming=${status}`);

  if (status === "success") {
    const { data, error } = await supabase.rpc("settle_service_transaction_success", {
      p_reference: reference,
      p_provider_reference: providerRef,
      p_api_response: payload,
    });
    if (error) return json({ error: error.message }, 500);
    console.log("[CDH-WEBHOOK] settled success:", data);
  } else if (status === "failed") {
    const { data, error } = await supabase.rpc("settle_service_transaction_failure", {
      p_reference: reference, p_reason: reason, p_api_response: payload,
    });
    if (error) return json({ error: error.message }, 500);
    console.log("[CDH-WEBHOOK] settled failure:", data);
  } else if (status === "refunded") {
    const { data, error } = await supabase.rpc("settle_service_transaction_refund", {
      p_reference: reference, p_reason: reason, p_api_response: payload,
    });
    if (error) return json({ error: error.message }, 500);
    console.log("[CDH-WEBHOOK] settled refund:", data);
  } else if (status === "pending" || status === "processing") {
    await supabase
      .from("service_transactions")
      .update({
        status: status === "processing" ? "processing" : "pending",
        api_response: payload,
        provider_reference: providerRef ?? undefined,
      })
      .eq("reference", reference)
      .in("status", ["initiated", "pending", "processing"]);
    console.log(`[CDH-WEBHOOK] set ${status} for ${reference}`);
  } else {
    console.warn(`[CDH-WEBHOOK] unknown status for ${reference} — no state change`);
  }

  await supabase
    .from("cheapdatahub_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);

  return json({ ok: true, reference, status }, 200);
});
