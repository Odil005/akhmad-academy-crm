export type JarvisAIProvider = {
  kind: "openai" | "gemini" | "lovable";
  label: string;
  apiBaseUrl: string;
  apiKey: string;
  chatModel: string;
  /** Model for short one-shot texts (daily report summary, parent bot answers). */
  quickModel: string;
  chatApi: "responses" | "chat_completions";
  /** Empty string = the provider has no voice endpoints. */
  transcriptionModel: string;
  speechModel: string;
};

type JarvisEnvironment = Record<string, string | undefined>;

const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const LOVABLE_API_BASE_URL = "https://ai.gateway.lovable.dev/v1";

export const AI_KEYS_HINT = "OPENAI_API_KEY, GEMINI_API_KEY yoki LOVABLE_API_KEY sozlanmagan";

/**
 * Resolve secrets on the server only. Own keys win over the Lovable gateway so the
 * app keeps working when hosted outside Lovable: OpenAI, then Gemini, then Lovable.
 */
export function resolveJarvisAIProvider(
  env: JarvisEnvironment = process.env,
): JarvisAIProvider | null {
  const openAIKey = env.OPENAI_API_KEY?.trim();
  if (openAIKey) {
    const chatModel = env.JARVIS_AI_MODEL?.trim() || "gpt-5.6-terra";
    return {
      kind: "openai",
      label: "OpenAI",
      apiBaseUrl: OPENAI_API_BASE_URL,
      apiKey: openAIKey,
      chatModel,
      quickModel: env.JARVIS_FAST_MODEL?.trim() || chatModel,
      chatApi: "responses",
      transcriptionModel: "gpt-4o-mini-transcribe",
      speechModel: "gpt-4o-mini-tts",
    };
  }

  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const chatModel = env.JARVIS_AI_MODEL?.trim() || "gemini-2.5-flash";
    return {
      kind: "gemini",
      label: "Google Gemini",
      apiBaseUrl: GEMINI_API_BASE_URL,
      apiKey: geminiKey,
      chatModel,
      quickModel: env.JARVIS_FAST_MODEL?.trim() || chatModel,
      chatApi: "chat_completions",
      transcriptionModel: "",
      speechModel: "",
    };
  }

  const lovableKey = env.LOVABLE_API_KEY?.trim();
  if (lovableKey) {
    return {
      kind: "lovable",
      label: "Lovable AI Gateway",
      apiBaseUrl: LOVABLE_API_BASE_URL,
      apiKey: lovableKey,
      chatModel: env.JARVIS_AI_MODEL?.trim() || "google/gemini-3.6-flash",
      quickModel: env.JARVIS_FAST_MODEL?.trim() || "google/gemini-3.8-flash",
      chatApi: "chat_completions",
      transcriptionModel: "openai/gpt-4o-mini-transcribe",
      speechModel: "openai/gpt-4o-mini-tts",
    };
  }

  return null;
}

export function publicJarvisAIStatus(env: JarvisEnvironment = process.env) {
  const provider = resolveJarvisAIProvider(env);
  return provider
    ? {
        configured: true as const,
        provider: provider.label,
        model: provider.chatModel,
      }
    : {
        configured: false as const,
        provider: null,
        model: null,
      };
}

/**
 * One-shot text completion through whichever provider is configured.
 * Returns "" when no provider exists or the call fails, so callers can fall back
 * to plain (non-AI) text instead of breaking reports or bot replies.
 */
export async function aiQuickText(
  system: string,
  user: string,
  options: { timeoutMs?: number; env?: JarvisEnvironment } = {},
): Promise<string> {
  const provider = resolveJarvisAIProvider(options.env ?? process.env);
  if (!provider) return "";
  try {
    const response = await fetch(`${provider.apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.quickModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
    if (!response.ok) return "";
    const json = (await response.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function jarvisSafetyIdentifier(userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`unicrm:${userId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function probeJarvisAIProvider(provider: JarvisAIProvider): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const isResponses = provider.chatApi === "responses";
    const response = await fetch(
      `${provider.apiBaseUrl}/${isResponses ? "responses" : "chat/completions"}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isResponses
            ? {
                model: provider.chatModel,
                input: "Faqat OK deb javob ber.",
                max_output_tokens: 48,
                reasoning: { effort: "none" },
                store: false,
              }
            : {
                model: provider.chatModel,
                messages: [{ role: "user", content: "Faqat OK deb javob ber." }],
                max_tokens: 16,
                temperature: 0,
              },
        ),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`AI provayder xatosi: ${response.status} ${detail}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
