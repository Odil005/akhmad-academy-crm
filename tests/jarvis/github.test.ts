import { describe, expect, it } from "vitest";
import {
  githubChangeTitle,
  isGitHubChangeCommand,
  sanitizeGitHubChangeRequest,
} from "../../src/features/jarvis/github";

describe("Jarvis GitHub commands", () => {
  it("recognizes explicit code changes", () => {
    expect(isGitHubChangeCommand("GitHubga yangi hisobot filtri qo'sh")).toBe(true);
    expect(isGitHubChangeCommand("Dashboardga yangi grafik qo'sh")).toBe(true);
  });

  it("does not confuse CRM records with source changes", () => {
    expect(isGitHubChangeCommand("Yangi o'quvchi qo'sh")).toBe(false);
    expect(isGitHubChangeCommand("Guruh yarat")).toBe(false);
  });

  it("removes secrets before creating a public task", () => {
    const cleaned = sanitizeGitHubChangeRequest(
      "GitHubga qo'sh github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
    );
    expect(cleaned).not.toContain("github_pat_");
    expect(cleaned).toContain("token olib tashlandi");
  });

  it("creates a bounded task title", () => {
    expect(githubChangeTitle(`Jarvis: ${"yangi funksiya ".repeat(20)}`).length).toBeLessThan(100);
  });
});
