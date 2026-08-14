const MAX_SPEECH_CHARACTERS = 900;

/**
 * Turns a screen-oriented Jarvis answer into a short, natural speech script.
 * The visual answer remains unchanged; only the TTS input is normalized.
 */
export function normalizeJarvisSpeech(text: string): string {
  const normalized = text
    .replace(/```[\s\S]*?```/g, " Kod namunasi ekranda ko'rsatildi. ")
    .replace(/\[([^\]]+)]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, "havola")
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ")
    .replace(/\bUNICRM\b/gi, "Uni si ar em")
    .replace(/\bCRM\b/gi, "si ar em")
    .replace(/\bAI\b/gi, "sun'iy intellekt")
    .replace(/\bUZS\b/gi, "so'm")
    .replace(/(\d)\s*%/g, "$1 foiz")
    .replace(/[*_#>`~]/g, "")
    .replace(/[•·]/g, ", ")
    .replace(/[—–]/g, ", ")
    .replace(/\.{2,}/g, ".")
    .replace(/([!?])\1+/g, "$1")
    .replace(/\s*[\r\n]+\s*/g, ". ")
    .replace(/([.!?])\s*[.!?]+/g, "$1")
    .replace(/\s+([,!.?])/g, "$1")
    .replace(/([,!.?])(?=[^\s])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= MAX_SPEECH_CHARACTERS) return normalized;

  const shortened = normalized.slice(0, MAX_SPEECH_CHARACTERS);
  const sentenceEnd = Math.max(
    shortened.lastIndexOf(". "),
    shortened.lastIndexOf("! "),
    shortened.lastIndexOf("? "),
  );
  const safeEnd = sentenceEnd >= 450 ? sentenceEnd + 1 : shortened.lastIndexOf(" ");
  return `${shortened.slice(0, safeEnd > 0 ? safeEnd : MAX_SPEECH_CHARACTERS).trim()}.`;
}
