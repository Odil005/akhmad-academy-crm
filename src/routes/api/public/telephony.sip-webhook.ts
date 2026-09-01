import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

// SIP provider webhook — call events (ringing/answered/hangup/recording).
// Verifies HMAC signature using sip_config.webhook_secret.

type SipEvent = {
  event?: "ringing" | "answered" | "hangup" | "recording_ready";
  sip_call_id?: string;
  from?: string;
  to?: string;
  direction?: "inbound" | "outbound";
  duration_sec?: number;
  hangup_cause?: string;
  answered_at?: string;
  recording_url?: string;
  cost?: number;
  trunk?: string;
  started_at?: string;
};

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

async function handle(request: Request) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const raw = await request.text();
  const sig = request.headers.get("x-sip-signature") ?? "";

  const { data: cfg } = await supabaseAdmin
    .from("sip_config")
    .select("webhook_secret, is_active")
    .maybeSingle();
  if (!cfg?.webhook_secret || !cfg.is_active) {
    return new Response("SIP not configured", { status: 503 });
  }

  const expected = createHmac("sha256", cfg.webhook_secret).update(raw).digest("hex");
  if (!sig || !safeEqual(sig, expected)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let evt: SipEvent;
  try {
    evt = JSON.parse(raw) as SipEvent;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const status = (() => {
    switch (evt.event) {
      case "ringing":
        return "ringing";
      case "answered":
        return "answered";
      case "hangup":
        return (evt.duration_sec ?? 0) > 0 ? "completed" : "missed";
      case "recording_ready":
        return "completed";
      default:
        return "completed";
    }
  })();

  const phone = evt.direction === "outbound" ? (evt.to ?? "") : (evt.from ?? "");

  // Upsert by sip_call_id
  const { data: existing } = await supabaseAdmin
    .from("calls")
    .select("id")
    .eq("sip_call_id", evt.sip_call_id ?? "__none__")
    .maybeSingle();

  if (existing?.id) {
    await supabaseAdmin
      .from("calls")
      .update({
        status,
        duration_sec: evt.duration_sec ?? 0,
        answered_at: evt.answered_at ?? null,
        hangup_cause: evt.hangup_cause ?? null,
        recording_url: evt.recording_url ?? null,
        cost: evt.cost ?? null,
        trunk: evt.trunk ?? null,
      })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("calls").insert({
      direction: evt.direction ?? "inbound",
      phone,
      duration_sec: evt.duration_sec ?? 0,
      status,
      called_at: evt.started_at ?? new Date().toISOString(),
      sip_call_id: evt.sip_call_id ?? null,
      trunk: evt.trunk ?? null,
      answered_at: evt.answered_at ?? null,
      hangup_cause: evt.hangup_cause ?? null,
      cost: evt.cost ?? null,
      recording_url: evt.recording_url ?? null,
    });
  }

  return Response.json({ ok: true });
}

export const Route = createFileRoute("/api/public/telephony/sip-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
    },
  },
});
