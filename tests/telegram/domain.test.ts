import { describe, expect, it } from "vitest";
import {
  decodeTelegramUuid,
  encodeTelegramUuid,
  isOwnTelegramContact,
  isPrivateTelegramChat,
  isValidTelegramWebhookSecret,
  makeTeacherCallback,
  parseTeacherCallback,
  splitTelegramMessage,
} from "../../src/features/telegram/domain";

describe("Telegram domain", () => {
  it("accepts only Telegram-compatible webhook secrets", () => {
    expect(isValidTelegramWebhookSecret("crm_secret-2026_Akhmad_Academy_01")).toBe(true);
    expect(isValidTelegramWebhookSecret("short_secret")).toBe(false);
    expect(isValidTelegramWebhookSecret("space is forbidden")).toBe(false);
    expect(isValidTelegramWebhookSecret("")).toBe(false);
  });

  it("accepts an own contact only in the sender's private chat", () => {
    expect(isPrivateTelegramChat("private")).toBe(true);
    expect(isPrivateTelegramChat("group")).toBe(false);
    expect(isOwnTelegramContact(12345, 12345, 12345)).toBe(true);
    expect(isOwnTelegramContact(99999, 12345, 12345)).toBe(false);
  });

  it("packs two UUIDs into a Telegram-safe callback", () => {
    const teacherId = "123e4567-e89b-42d3-a456-426614174000";
    const studentId = "8f14e45f-ea7a-4c21-9e64-8aa8c7b7fd01";
    const value = makeTeacherCallback("meet", teacherId, studentId);
    expect(new TextEncoder().encode(value).length).toBeLessThanOrEqual(64);
    expect(parseTeacherCallback(value)).toEqual({ action: "meet", teacherId, studentId });
    expect(decodeTelegramUuid(encodeTelegramUuid(teacherId))).toBe(teacherId);
  });

  it("splits long messages below Telegram's limit", () => {
    const chunks = splitTelegramMessage(`${"a".repeat(2500)}\n${"b".repeat(2500)}`);
    expect(chunks.length).toBe(2);
    expect(chunks.every((chunk) => chunk.length <= 4000)).toBe(true);
    expect(chunks.join("\n")).toContain("b".repeat(100));
  });
});
