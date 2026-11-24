/**
 * One display rule for a student's name everywhere (CRM pages, Telegram bot,
 * notifications): "Familiya Ism" from the parts first, then the stored full name, then the linked profile. Most students have no profile row, so a
 * profile-only lookup shows an empty name.
 */
export type StudentNameParts = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile?: { full_name?: string | null } | null;
} | null | undefined;

export function studentDisplayName(s: StudentNameParts, fallback = "O'quvchi"): string {
  if (!s) return fallback;
  return (
    [s.last_name?.trim(), s.first_name?.trim()].filter(Boolean).join(" ") ||
    s.full_name?.trim() ||
    s.profile?.full_name?.trim() ||
    fallback
  );
}
