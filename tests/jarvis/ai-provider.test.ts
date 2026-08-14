import { describe, expect, it } from "vitest";
import { publicJarvisAIStatus, resolveJarvisAIProvider } from "../../src/lib/jarvis-ai.server";

describe("Jarvis AI provider", () => {
  it("prefers direct OpenAI and never exposes the key in status", () => {
    const provider = resolveJarvisAIProvider({
      OPENAI_API_KEY: "openai-secret",
      LOVABLE_API_KEY: "lovable-secret",
    });
    expect(provider?.kind).toBe("openai");
    expect(provider?.chatApi).toBe("responses");
    expect(provider?.chatModel).toBe("gpt-5.6-terra");
    expect(publicJarvisAIStatus({ OPENAI_API_KEY: "openai-secret" })).toEqual({
      configured: true,
      provider: "OpenAI",
      model: "gpt-5.6-terra",
    });
  });

  it("retains Lovable as a compatible fallback", () => {
    const provider = resolveJarvisAIProvider({ LOVABLE_API_KEY: "lovable-secret" });
    expect(provider?.kind).toBe("lovable");
    expect(provider?.chatApi).toBe("chat_completions");
    expect(provider?.speechModel).toBe("openai/gpt-4o-mini-tts");
  });

  it("reports an unconfigured provider without a secret", () => {
    expect(resolveJarvisAIProvider({})).toBeNull();
    expect(publicJarvisAIStatus({})).toEqual({
      configured: false,
      provider: null,
      model: null,
    });
  });
});
