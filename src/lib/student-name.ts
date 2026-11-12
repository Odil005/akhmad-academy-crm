/**
 * One display rule for a student's name everywhere (CRM pages, Telegram bot,
 * notifications): the stored full name first, then "Familiya Ism" from the
 * parts, then the linked profile. Most students have no profile row, so a
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
    s.full_name?.trim() ||
    [s.last_name?.trim(), s.first_name?.trim()].filter(Boolean).join(" ") ||
    s.profile?.full_name?.trim() ||
    fallback
  );
}
