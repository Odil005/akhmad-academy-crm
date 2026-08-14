export const JARVIS_SAFE_SETTINGS = {
  contact_info: {
    label: "Aloqa ma'lumotlari",
    scope: "director",
    fields: ["address", "phone", "email", "telegram", "instagram"],
  },
  homepage_stats: {
    label: "Bosh sahifa raqamlari",
    scope: "shared",
    fields: ["students", "courses", "teachers", "satisfaction"],
  },
  sms_templates: {
    label: "SMS shablonlari",
    scope: "admin",
    fields: ["payment_reminder"],
  },
} as const;

export type JarvisSafeSettingKey = keyof typeof JARVIS_SAFE_SETTINGS;

export function isJarvisSafeSettingKey(value: string): value is JarvisSafeSettingKey {
  return Object.prototype.hasOwnProperty.call(JARVIS_SAFE_SETTINGS, value);
}

export function sanitizeJarvisSettingValues(
  key: string,
  input: unknown,
): Record<string, string> | null {
  if (!isJarvisSafeSettingKey(key) || !input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  const allowed = new Set<string>(JARVIS_SAFE_SETTINGS[key].fields);
  const clean: Record<string, string> = {};
  for (const [field, raw] of Object.entries(input)) {
    if (!allowed.has(field) || typeof raw !== "string") continue;
    const value = raw.trim().slice(0, field === "payment_reminder" ? 1000 : 240);
    clean[field] = value;
  }
  return Object.keys(clean).length ? clean : null;
}
