/** Shared rules for the parent sign-in (browser-safe, no server imports). */
export const PARENT_CODE_LIMITS = {
  ttlMinutes: 5,
  maxAttempts: 5,
  maxCodesPerWindow: 3,
  windowMinutes: 10,
} as const;

/** Parent phones are matched by their last 9 digits (Uzbekistan mobile number without +998). */
export function normalizeParentPhone(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(-9);
}

export async function parentCodeHash(phone: string, code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`parent-login:${phone}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** True when the signed-in account only has the parent role and must stay out of the CRM. */
export function isParentOnly(roles: readonly string[]): boolean {
  return roles.length > 0 && roles.every((r) => r === "parent");
}
