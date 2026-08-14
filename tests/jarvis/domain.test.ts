import { describe, expect, it } from "vitest";
import {
  canUseJarvisTool,
  getDirectJarvisIntent,
  getLocalJarvisReply,
  isExplicitJarvisAction,
  isJarvisMutatingTool,
} from "../../src/features/jarvis/domain";

describe("Jarvis action safety", () => {
  it("manager can repair queues but teacher cannot", () => {
    expect(canUseJarvisTool(["admin"], "repair_system_queues")).toBe(true);
    expect(canUseJarvisTool(["teacher"], "repair_system_queues")).toBe(false);
    expect(canUseJarvisTool(["admin"], "create_github_change_request")).toBe(true);
    expect(canUseJarvisTool(["director"], "create_github_change_request")).toBe(false);
  });

  it("teacher can send only the parent-message tool", () => {
    expect(canUseJarvisTool(["teacher"], "send_parent_message")).toBe(true);
    expect(canUseJarvisTool(["teacher"], "create_student")).toBe(false);
  });

  it("requires an explicit verb before a mutation", () => {
    expect(isExplicitJarvisAction("Ali ota-onasiga xabar yubor", "send_parent_message")).toBe(true);
    expect(
      isExplicitJarvisAction("Alining ota-onasi haqida nima deysan?", "send_parent_message"),
    ).toBe(false);
    expect(isExplicitJarvisAction("Tizim xatolarini tuzat", "repair_system_queues")).toBe(true);
  });

  it("classifies read and write tools", () => {
    expect(isJarvisMutatingTool("send_parent_message")).toBe(true);
    expect(isJarvisMutatingTool("unread_parent_messages")).toBe(false);
  });

  it("recognizes fast operational commands without an AI round-trip", () => {
    expect(getDirectJarvisIntent("Xabar bormi?")).toBe("unread_messages");
    expect(getDirectJarvisIntent("Tizimni tekshir")).toBe("system_health");
    expect(getDirectJarvisIntent("Tizim navbatlarini tuzat")).toBe("repair_queues");
    expect(getDirectJarvisIntent("GitHubga yangi hisobot filtri qo'sh")).toBe(
      "github_change_request",
    );
    expect(getDirectJarvisIntent("Bugun qanday ishlaymiz?")).toBeNull();
  });

  it("answers basic conversation before an AI provider is configured", () => {
    expect(getLocalJarvisReply("Salom Jarvis")).toContain("Assalomu alaykum");
    expect(getLocalJarvisReply("Rahmat")).toContain("Arzimaydi");
    expect(getLocalJarvisReply("Bugungi qarzdorlarni tahlil qil")).toBeNull();
  });
});
