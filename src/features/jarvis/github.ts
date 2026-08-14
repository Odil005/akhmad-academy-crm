const CODE_CHANGE_WORDS =
  /(qo['‘’`]?sh|yarat|kirit|ishlab chiq|amalga oshir|yangila|o['‘’`]?zgartir|tuzat|fix|implement)/i;
const BUSINESS_RECORD_WORDS =
  /(o['‘’`]?quvchi|talaba|guruh|o['‘’`]?qituvchi|lid|mijoz|fan|to['‘’`]?lovni? qo['‘’`]?sh)/i;

export function isGitHubChangeCommand(text: string): boolean {
  const normalized = text.toLocaleLowerCase("uz-UZ").replaceAll("’", "'").trim();
  if (!CODE_CHANGE_WORDS.test(normalized)) return false;
  if (/(git\s*hub)/i.test(normalized)) return true;
  if (BUSINESS_RECORD_WORDS.test(normalized)) return false;
  return /(yangi\s+(funksiya|imkoniyat|bo['‘’`]?lim|tugma)|(?:tizim|sayt|dashboard|jarvis)(?:ga|da)?\b)/i.test(
    normalized,
  );
}

export function sanitizeGitHubChangeRequest(text: string): string {
  const withoutControls = Array.from(text, (character) => {
    const code = character.charCodeAt(0);
    return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127
      ? " "
      : character;
  }).join("");
  return withoutControls
    .replace(/\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{16,}\b/g, "[GitHub token olib tashlandi]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[API kalit olib tashlandi]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

export function githubChangeTitle(request: string): string {
  const cleaned = sanitizeGitHubChangeRequest(request)
    .replace(/^jarvis[,\s:-]*/i, "")
    .replace(/^(?:git\s*hub(?:ga)?[,\s:-]*)/i, "")
    .trim();
  const title = cleaned || "Yangi CRM o'zgarishi";
  return `[Jarvis] ${title.slice(0, 82).trim()}`;
}
