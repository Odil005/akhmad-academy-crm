// Utilities to auto-generate usernames and access codes from name + phone.
const translitMap: Record<string, string> = {
  ' ': '', "'": '', '`': '', ʻ: '', ʼ: '',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

export function slugName(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => translitMap[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

export function generateUsername(firstName: string, lastName: string, phone: string): string {
  const f = slugName(firstName).slice(0, 8);
  const l = slugName(lastName).slice(0, 8);
  const p = (phone || '').replace(/\D/g, '').slice(-4) || Math.floor(1000 + Math.random() * 9000).toString();
  return `${f || 'user'}.${l || 'x'}${p}`;
}

export function generateAccessCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => alphabet[b % alphabet.length]).join('');
}

/** Internal auth email domain used for username-based logins. */
export const AUTH_EMAIL_DOMAIN = 'akhmadacademy.local';
/** Older domains kept only so previously created accounts can still sign in. */
export const LEGACY_AUTH_EMAIL_DOMAINS = ['edunest.local'];

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export function legacyUsernameEmails(username: string): string[] {
  const u = username.trim().toLowerCase();
  return LEGACY_AUTH_EMAIL_DOMAINS.map((d) => `${u}@${d}`);
}

export function emailToUsername(email: string): string {
  const domains = [AUTH_EMAIL_DOMAIN, ...LEGACY_AUTH_EMAIL_DOMAINS];
  for (const d of domains) {
    if (email.toLowerCase().endsWith(`@${d}`)) return email.slice(0, -(d.length + 1));
  }
  return email;
}
