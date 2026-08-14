import { describe, expect, it } from "vitest";
import { normalizeJarvisSpeech } from "../../src/features/jarvis/speech";

describe("Jarvis speech normalization", () => {
  it("removes visual formatting and makes CRM terms pronounceable", () => {
    expect(normalizeJarvisSpeech("🤖 **UNICRM AI** tayyor...\nTo'lov: 25% UZS")).toBe(
      "Uni si ar em sun'iy intellekt tayyor. To'lov: 25 foiz so'm",
    );
  });

  it("keeps link labels instead of reading the URL", () => {
    expect(normalizeJarvisSpeech("[Hisobotni oching](https://example.com/report)")).toBe(
      "Hisobotni oching",
    );
  });

  it("shortens long speech at a natural boundary", () => {
    const result = normalizeJarvisSpeech(`${"Birinchi jumla. ".repeat(80)}Yakun.`);
    expect(result.length).toBeLessThanOrEqual(901);
    expect(result.endsWith(".")).toBe(true);
  });
});
