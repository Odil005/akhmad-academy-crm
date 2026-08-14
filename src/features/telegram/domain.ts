const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TELEGRAM_MESSAGE_LIMIT = 4096;
export const TELEGRAM_SAFE_MESSAGE_LIMIT = 4000;
export const TELEGRAM_CALLBACK_LIMIT = 64;

export function isValidTelegramWebhookSecret(secret: string): boolean {
  return /^[A-Za-z0-9_-]{32,256}$/.test(secret);
}

export function isPrivateTelegramChat(chatType: string | null | undefined): boolean {
  return chatType === "private";
}

export function isOwnTelegramContact(
  contactUserId: number | null | undefined,
  senderUserId: number | null | undefined,
  chatId: number | null | undefined,
): boolean {
  return (
    Number.isSafeInteger(contactUserId) &&
    Number.isSafeInteger(senderUserId) &&
    Number.isSafeInteger(chatId) &&
    contactUserId === senderUserId &&
    senderUserId === chatId
  );
}

export function encodeTelegramUuid(uuid: string): string {
  if (!UUID_RE.test(uuid)) throw new Error("UUID formati noto'g'ri");
  const hex = uuid.replace(/-/g, "");
  let binary = "";
  for (let i = 0; i < hex.length; i += 2) {
    binary += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeTelegramUuid(encoded: string): string | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(encoded)) return null;
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + "==";
    const binary = atob(base64);
    if (binary.length !== 16) return null;
    const hex = Array.from(binary, (char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join(
      "",
    );
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    return UUID_RE.test(uuid) ? uuid : null;
  } catch {
    return null;
  }
}

export function makeTeacherCallback(
  action: "tch" | "meet",
  teacherId: string,
  studentId: string,
): string {
  const value = `${action}:${encodeTelegramUuid(teacherId)}:${encodeTelegramUuid(studentId)}`;
  if (new TextEncoder().encode(value).length > TELEGRAM_CALLBACK_LIMIT) {
    throw new Error("Telegram callback_data 64 baytdan oshib ketdi");
  }
  return value;
}

export function parseTeacherCallback(value: string): {
  action: "tch" | "meet";
  teacherId: string;
  studentId: string;
} | null {
  const [action, teacher, student, extra] = value.split(":");
  if ((action !== "tch" && action !== "meet") || extra !== undefined) return null;
  const teacherId = decodeTelegramUuid(teacher);
  const studentId = decodeTelegramUuid(student);
  return teacherId && studentId ? { action, teacherId, studentId } : null;
}

export function splitTelegramMessage(text: string, limit = TELEGRAM_SAFE_MESSAGE_LIMIT): string[] {
  if (!text) return [""];
  if (!Number.isInteger(limit) || limit < 1 || limit > TELEGRAM_MESSAGE_LIMIT) {
    throw new Error("Telegram xabar limiti noto'g'ri");
  }

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < Math.floor(limit * 0.6)) cut = rest.lastIndexOf(" ", limit);
    if (cut < Math.floor(limit * 0.6)) cut = limit;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest || chunks.length === 0) chunks.push(rest);
  return chunks;
}

export function normalizeTelegramAppBaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}
