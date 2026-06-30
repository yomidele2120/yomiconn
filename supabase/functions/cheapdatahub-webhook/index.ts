// CheapDataHub webhook receiver
// Public endpoint — no JWT required. Verifies optional shared secret.
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

// Best-effort field extraction — CheapDataHub payloads vary by service
function pickReference(p: any): string | null {
  return (
    p?.reference ??
    p?.transaction_reference ??
    p?.client_reference ??
    p?.merchant_reference ??
    p?.order_id ??
    p?.request_id ??
    p?.data?.reference ??
    p?.data?.transaction_reference ??
    p?.data?.client_reference ??
    null
  );
}

function pickProviderRef(p: any): string | null {
  return (
    p?.provider_reference ??
    p?.transaction_id ??
    p?.api_reference ??
    p?.data?.provider_reference ??
    p?.data?.transaction_id ??
    p?.data?.api_reference ??
    null
  );
}

function pickStatus(p: any): string {
  const raw = String(
    p?.status ?? p?.transaction_status ?? p?.data?.status ?? p?.event ?? ""
  ).toLowerCase();
  if (["success", "successful", "completed", "delivered", "paid"].includes(raw)) return "success";
  if (["failed", "failure", "error", "declined", "cancelled", "canceled", "reversed"].includes(raw))
    return "failed";
  if (["pending", "processing", "initiated", "in_progress"].includes(raw)) return "pending";
  return raw || "unknown";
}

function pickReason(p: any): string | null {
  return p?.message ?? p?.reason ?? p?.error ?? p?.data?.message ?? p?.data?.reason ?? null;
}

function pickEventId(p: any, ref: string | null, status: string): string {
  return (
    p?.event_id ??
    p?.id ??
    p?.data?.event_id ??
    p?.data?.id ??
    `${ref ?? "noref"}:${status}:${p?.timestamp ?? p?.data?.timestamp ?? Date.now()}`
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Optional shared-secret verification ──
  const sharedSecret = Deno.env.get("CHEAPDATAHUB_WEBHOOK_SECRET");
  if (sharedSecret) {
    const provided =
      req.headers.get("x-webhook-secret") ??
      req.headers.get("x-cheapdatahub-signature") ??
      req.headers.get("x-signature");
    if (provided !== sharedSecret) {
      console.warn("[CDH-WEBHOOK] signature mismatch");
      return json({ error: "Invalid signature" }, 400);
    }
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  console.log("[CDH-WEBHOOK] payload:", JSON.stringify(payload).slice(0, 1000));

  const reference = pickReference(payload);
  const status = pickStatus(payload);
  const providerRef = pickProviderRef(payload);
  const reason = pickReason(payload);
  const eventId = pickEventId(payload, reference, status);

  if (!reference) {
    console.error("[CDH-WEBHOOK] no reference in payload");
    return json({ error: "Missing transaction reference" }, 400);
  }

  // ── Idempotency: insert event row; UNIQUE on event_id blocks dupes ──
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
    if (error) {
      console.error("[CDH-WEBHOOK] settle success error:", error);
      return json({ error: error.message }, 500);
    }
    console.log("[CDH-WEBHOOK] settled success:", data);
  } else if (status === "failed") {
    const { data, error } = await supabase.rpc("settle_service_transaction_failure", {
      p_reference: reference,
      p_reason: reason,
      p_api_response: payload,
    });
    if (error) {
      console.error("[CDH-WEBHOOK] settle failure error:", error);
      return json({ error: error.message }, 500);
    }
    console.log("[CDH-WEBHOOK] settled failure:", data);
  } else {
    // pending / unknown — keep transaction open, update latest status
    await supabase
      .from("service_transactions")
      .update({ status: "pending", api_response: payload })
      .eq("reference", reference)
      .in("status", ["initiated", "pending", "processing"]);
    console.log(`[CDH-WEBHOOK] kept pending for ${reference}`);
  }

  // mark event processed
  await supabase
    .from("cheapdatahub_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);

  return json({ ok: true, reference, status }, 200);
});
