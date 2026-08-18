/**
 * Server-only helpers for parent-submitted payment receipts (Telegram → finance desk).
 * Kept out of *.functions.ts so route chunks never pull the admin client.
 */
import { callTelegram, getTelegramBotToken, sendTelegramText } from "@/lib/telegram.server";

const RECEIPT_BUCKET = "payment-receipts";

export function money(value: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(value));
}

/** Pull the first plausible sum out of a caption ("450 000 so'm", "450000"). */
export function parseDeclaredAmount(caption: string | null | undefined): number | null {
  const cleaned = (caption ?? "").replace(/[\u00a0\u202f]/g, " ");
  const match = cleaned.match(/(\d[\d\s.,]{2,})/);
  if (!match) return null;
  const digits = match[1].replace(/[^\d]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function currentPeriodMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Download a Telegram file and push it into the private receipts bucket. */
export async function storeTelegramReceipt(
  admin: {
    storage: {
      from: (b: string) => {
        upload: (
          path: string,
          body: ArrayBuffer | Uint8Array,
          opts: { contentType: string; upsert: boolean },
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  },
  fileId: string,
): Promise<{ path: string } | { error: string }> {
  const token = getTelegramBotToken();
  if (!token) return { error: "TELEGRAM_BOT_TOKEN sozlanmagan" };

  const info = await callTelegram<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!info.ok || !info.result.file_path) {
    return { error: info.ok ? "Fayl manzili topilmadi" : info.error };
  }
  const filePath = info.result.file_path;
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!response.ok) return { error: `Fayl yuklab olinmadi (HTTP ${response.status})` };
  const bytes = new Uint8Array(await response.arrayBuffer());

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "jpg";
  const contentType =
    ext === "png" ? "image/png" : ext === "pdf" ? "application/pdf" : "image/jpeg";
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;

  const { error } = await admin.storage
    .from(RECEIPT_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) return { error: error.message };
  return { path };
}

/** Short-lived link so admin/director can look at the receipt image. */
export async function receiptSignedUrl(
  admin: {
    storage: {
      from: (b: string) => {
        createSignedUrl: (
          path: string,
          seconds: number,
        ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
      };
    };
  },
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await admin.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

/** Alert every admin/director Telegram chat that a new receipt is waiting. */
export async function notifyStaffNewReceipt(
  admin: { from: (table: string) => any },
  payload: { studentName: string; amount: number | null; note?: string | null },
): Promise<number> {
  const [{ data: links }, { data: recipients }] = await Promise.all([
    admin.from("staff_telegram_links").select("telegram_chat_id, role").eq("is_active", true),
    admin.from("director_report_recipients").select("telegram_chat_id").eq("is_active", true),
  ]);

  const chatIds = new Set<string>();
  for (const row of (links ?? []) as Array<{ telegram_chat_id: string | null; role: string }>) {
    if (row.telegram_chat_id && (row.role === "admin" || row.role === "director")) {
      chatIds.add(String(row.telegram_chat_id));
    }
  }
  for (const row of (recipients ?? []) as Array<{ telegram_chat_id: string | null }>) {
    if (row.telegram_chat_id) chatIds.add(String(row.telegram_chat_id));
  }
  if (!chatIds.size) return 0;

  const text = [
    "🧾 Yangi to'lov cheki keldi",
    `O'quvchi: ${payload.studentName}`,
    payload.amount ? `Summa: ${money(payload.amount)} so'm` : "Summa: ko'rsatilmagan",
    payload.note ? `Izoh: ${payload.note}` : null,
    "",
    "CRM → Moliya → Chek tasdiqlash bo'limida ko'rib tasdiqlang.",
  ]
    .filter(Boolean)
    .join("\n");

  let sent = 0;
  for (const chatId of chatIds) {
    const result = await sendTelegramText(chatId, text);
    if (result.ok) sent += 1;
  }
  return sent;
}

export function parentDecisionText(
  approved: boolean,
  data: { studentName: string; amount: number; note?: string | null },
) {
  return approved
    ? [
        "✅ To'lovingiz tasdiqlandi",
        `O'quvchi: ${data.studentName}`,
        `Summa: ${money(data.amount)} so'm`,
        data.note ? `Izoh: ${data.note}` : null,
        "",
        "Rahmat! Kvitansiya CRM tizimida saqlandi.",
      ]
        .filter(Boolean)
        .join("\n")
    : [
        "❌ To'lov cheki tasdiqlanmadi",
        `O'quvchi: ${data.studentName}`,
        data.note ? `Sabab: ${data.note}` : "Sabab ko'rsatilmagan",
        "",
        "Iltimos, chekni qayta yuboring yoki administrator bilan bog'laning.",
      ]
        .filter(Boolean)
        .join("\n");
}
