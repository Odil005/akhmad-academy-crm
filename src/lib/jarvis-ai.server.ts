export type JarvisAIProvider = {
  kind: "openai" | "lovable";
  label: string;
  apiBaseUrl: string;
  apiKey: string;
  chatModel: string;
  chatApi: "responses" | "chat_completions";
  transcriptionModel: string;
  speechModel: string;
};

type JarvisEnvironment = Record<string, string | undefined>;

const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const LOVABLE_API_BASE_URL = "https://ai.gateway.lovable.dev/v1";

/** Resolve secrets on the server only. OpenAI is preferred when both providers exist. */
export function resolveJarvisAIProvider(
  env: JarvisEnvironment = process.env,
): JarvisAIProvider | null {
  const openAIKey = env.OPENAI_API_KEY?.trim();
  if (openAIKey) {
    return {
      kind: "openai",
      label: "OpenAI",
      apiBaseUrl: OPENAI_API_BASE_URL,
      apiKey: openAIKey,
      chatModel: env.JARVIS_AI_MODEL?.trim() || "gpt-5.6-terra",
      chatApi: "responses",
      transcriptionModel: "gpt-4o-mini-transcribe",
      speechModel: "gpt-4o-mini-tts",
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
