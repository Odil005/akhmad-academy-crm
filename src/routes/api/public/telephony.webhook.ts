import { createFileRoute } from "@tanstack/react-router";

// GSM modem / GoIP / chan_dongle / SIM800 webhook.
// Accepts GET or POST, JSON or form-urlencoded, wide field aliases.
// Auth: ?secret=... (query) or X-Auth-Token header.

type Payload = Record<string, unknown>;

const ALLOWED_STATUSES = ["completed", "missed", "busy", "failed", "no_answer", "ringing", "answered", "queued"] as const;

function mapEvent(ev: string | undefined, hasDuration: boolean): string {
  const e = (ev ?? "").toLowerCase();
  if (e === "ring" || e === "ringing" || e === "start") return "ringing";
  if (e === "answer" || e === "answered" || e === "in_call") return "answered";
  if (e === "hangup" || e === "end" || e === "completed") return hasDuration ? "completed" : "no_answer";
  if (e === "missed" || e === "noanswer" || e === "no_answer") return "missed";
  if (e === "busy") return "busy";
  if (e === "failed" || e === "error" || e === "congestion") return "failed";
  return "completed";
}

async function parseBody(request: Request): Promise<Payload> {
  const ct = request.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) return (await request.json()) as Payload;
    if (ct.includes("form")) {
      const fd = await request.formData();
      const obj: Payload = {};
      fd.forEach((v, k) => { obj[k] = typeof v === "string" ? v : v.name; });
      return obj;
    }
    const text = await request.text();
    if (!text) return {};
    try { return JSON.parse(text) as Payload; } catch {
      const obj: Payload = {};
      new URLSearchParams(text).forEach((v, k) => { obj[k] = v; });
      return obj;
    }
  } catch { return {}; }
}

export const Route = createFileRoute("/api/public/telephony/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request, true),
      POST: async ({ request }) => handle(request, false),
    },
  },
});

async function handle(request: Request, isGet: boolean) {
  const url = new URL(request.url);
  const expected = process.env.TELEPHONY_WEBHOOK_SECRET;
  const secret = url.searchParams.get("secret") ?? request.headers.get("x-auth-token");
  if (!expected || secret !== expected) return new Response("Unauthorized", { status: 401 });

  let payload: Payload = {};
  if (isGet) {
    url.searchParams.forEach((v, k) => { payload[k] = v; });
  } else {
    payload = await parseBody(request);
    url.searchParams.forEach((v, k) => { if (!(k in payload) && k !== "secret") payload[k] = v; });
  }

  const rawDirection = String(payload.direction ?? payload.type ?? payload.call_type ?? "").toLowerCase();
  const direction: "inbound" | "outbound" =
    ["in", "inbound", "incoming", "ring"].includes(rawDirection) ? "inbound" : "outbound";

  const phone = String(
    payload.phone ?? payload.caller ?? payload.callerid ?? payload.from ??
    payload.callee ?? payload.to ?? payload.msisdn ?? payload.number ?? ""
  ).trim();
  if (!phone) return new Response("Missing phone", { status: 400 });

  const duration_sec = Number(payload.duration_sec ?? payload.duration ?? payload.billsec ?? 0) || 0;
  const event = String(payload.event ?? payload.status ?? "");
  let status = ALLOWED_STATUSES.includes(event as typeof ALLOWED_STATUSES[number])
    ? event : mapEvent(event, duration_sec > 0);
  if (!ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) status = "completed";

  const recording_url =
    (payload.recording_url as string) ?? (payload.record_url as string) ??
    (payload.recording as string) ?? (payload.audio_url as string) ?? null;
  const called_at =
    (payload.called_at as string) ?? (payload.timestamp as string) ??
    (payload.time as string) ?? new Date().toISOString();

  // SMS support — store as call row with text in notes
  const smsText = (payload.sms as string) ?? (payload.text as string) ?? (payload.message as string) ?? null;
  const providedNotes = (payload.notes as string) ?? null;
  const notes = smsText ? `[SMS] ${smsText}${providedNotes ? ` — ${providedNotes}` : ""}` : providedNotes;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("calls").insert({
    direction, phone, status, duration_sec, recording_url,
    called_at: new Date(called_at).toISOString(), notes,
  });
  if (error) return new Response(error.message, { status: 500 });
  return new Response("ok");
}
