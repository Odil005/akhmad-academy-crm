import { describe, expect, it } from "vitest";
import {
  aiQuickText,
  publicJarvisAIStatus,
  resolveJarvisAIProvider,
} from "../../src/lib/jarvis-ai.server";

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

  it("uses an own Gemini key before the Lovable gateway, without voice", () => {
    const provider = resolveJarvisAIProvider({
      GEMINI_API_KEY: "gemini-secret",
      LOVABLE_API_KEY: "lovable-secret",
    });
    expect(provider?.kind).toBe("gemini");
    expect(provider?.apiBaseUrl).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai",
    );
    expect(provider?.chatApi).toBe("chat_completions");
    expect(provider?.speechModel).toBe("");
    expect(provider?.transcriptionModel).toBe("");
  });

  it("keeps OpenAI ahead of Gemini when both own keys exist", () => {
    const provider = resolveJarvisAIProvider({
      OPENAI_API_KEY: "openai-secret",
      GEMINI_API_KEY: "gemini-secret",
    });
    expect(provider?.kind).toBe("openai");
  });

  it("quick text returns empty without any AI key instead of failing", async () => {
    await expect(aiQuickText("system", "user", { env: {} })).resolves.toBe("");
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
