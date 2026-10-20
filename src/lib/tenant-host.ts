export function normalizeHost(host: string | null | undefined): string {
  return String(host ?? "")
    .toLowerCase()
    .split(",")[0]!
    .trim()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}
