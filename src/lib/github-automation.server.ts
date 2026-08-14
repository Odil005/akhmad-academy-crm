import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { githubChangeTitle, sanitizeGitHubChangeRequest } from "@/features/jarvis/github";

const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";

type GitHubConfiguration = {
  token: string;
  repository: string;
  baseBranch: string;
  autoCode: boolean;
};

export type GitHubAutomationStatus = {
  configured: boolean;
  connected: boolean;
  repository: string;
  baseBranch: string;
  autoCode: boolean;
  error?: string;
};

export type GitHubChangeResult = {
  ok: true;
  mode: "copilot_pr" | "issue";
  issueNumber: number;
  url: string;
  repository: string;
  warning?: string;
};

function configuration(): GitHubConfiguration {
  const repository = (process.env.GITHUB_JARVIS_REPOSITORY || "Odil005/akhmad-academy-crm")
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("GITHUB_JARVIS_REPOSITORY owner/repository ko'rinishida bo'lishi kerak");
  }
  return {
    token: (process.env.GITHUB_JARVIS_TOKEN || "").trim(),
    repository,
    baseBranch: (process.env.GITHUB_JARVIS_BASE_BRANCH || "main").trim() || "main",
    autoCode: process.env.GITHUB_JARVIS_AUTO_CODE !== "false",
  };
}

function headers(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": API_VERSION,
  };
}

async function githubRequest(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function githubError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    return String(payload.message || `HTTP ${response.status}`).slice(0, 240);
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function probeGitHubAutomation(): Promise<GitHubAutomationStatus> {
  let config: GitHubConfiguration;
  try {
    config = configuration();
  } catch (error) {
    return {
      configured: false,
      connected: false,
      repository: process.env.GITHUB_JARVIS_REPOSITORY || "",
      baseBranch: process.env.GITHUB_JARVIS_BASE_BRANCH || "main",
      autoCode: false,
      error: error instanceof Error ? error.message : "GitHub sozlamasi noto'g'ri",
    };
  }
  if (!config.token) {
    return {
      configured: false,
      connected: false,
      repository: config.repository,
      baseBranch: config.baseBranch,
      autoCode: config.autoCode,
      error: "GITHUB_JARVIS_TOKEN sozlanmagan",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${GITHUB_API}/repos/${config.repository}`, {
      headers: headers(config.token),
      signal: controller.signal,
    });
    return {
      configured: true,
      connected: response.ok,
      repository: config.repository,
      baseBranch: config.baseBranch,
      autoCode: config.autoCode,
      error: response.ok ? undefined : await githubError(response),
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      repository: config.repository,
      baseBranch: config.baseBranch,
      autoCode: config.autoCode,
      error: error instanceof Error ? error.message : "GitHub bilan aloqa uzildi",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function createGitHubChangeRequest(input: {
  request: string;
  actorUserId: string;
}): Promise<GitHubChangeResult> {
  const config = configuration();
  if (!config.token) {
    throw new Error(
      "GitHub hali ulanmagan. Vercel'da GITHUB_JARVIS_TOKEN ni kiriting va qayta deploy qiling.",
    );
  }

  const request = sanitizeGitHubChangeRequest(input.request);
  if (request.length < 12) throw new Error("Qanday o'zgarish kerakligini aniqroq yozing");

  const audit = await supabaseAdmin
    .from("jarvis_github_requests")
    .insert({
      actor_user_id: input.actorUserId,
      request_text: request,
      repository: config.repository,
      status: "processing",
    })
    .select("id")
    .maybeSingle();
  const auditId = audit.data?.id;

  const body = [
    "## Administrator so'rovi",
    request,
    "",
    "## Majburiy xavfsizlik va sifat talablari",
    "- Alohida branch va pull request yarating; main branchga bevosita yozmang va avtomatik merge qilmang.",
    "- Mavjud rol/RLS himoyasini chetlab o'tmang, maxfiy kalitlarni kodga yozmang.",
    "- Ma'lumotni o'chiruvchi migratsiya yaratmang; zarur bo'lsa faqat qo'shimcha va qaytariladigan migratsiya ishlating.",
    "- TypeScript, lint va testlarni ishga tushiring; xatolarni PR tavsifida ko'rsating.",
    "- Foydalanuvchining boshqa funksiyalarini buzmasdan eng kichik to'liq o'zgarishni qiling.",
    "",
    "Bu vazifa UNICRM Jarvis orqali autentifikatsiyadan o'tgan administrator tomonidan yuborildi.",
  ].join("\n");

  const issuePayload: Record<string, unknown> = {
    title: githubChangeTitle(request),
    body,
  };
  if (config.autoCode) {
    issuePayload.assignees = ["copilot-swe-agent[bot]"];
    issuePayload.agent_assignment = {
      target_repo: config.repository,
      base_branch: config.baseBranch,
      custom_instructions:
        "Implement only the requested scoped change, preserve security boundaries, run the repository quality checks, and open a pull request for human review. Never merge it.",
      custom_agent: "",
      model: "",
    };
  }

  let response = await githubRequest(`${GITHUB_API}/repos/${config.repository}/issues`, {
    method: "POST",
    headers: headers(config.token),
    body: JSON.stringify(issuePayload),
  });
  let mode: GitHubChangeResult["mode"] = config.autoCode ? "copilot_pr" : "issue";
  let warning: string | undefined;

  if (!response.ok && config.autoCode) {
    const copilotError = await githubError(response);
    response = await githubRequest(`${GITHUB_API}/repos/${config.repository}/issues`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify({ title: githubChangeTitle(request), body }),
    });
    mode = "issue";
    warning = `GitHub vazifasi yaratildi, lekin Copilot avtomatik kodlash ishga tushmadi: ${copilotError}`;
  }

  if (!response.ok) {
    const message = await githubError(response);
    if (auditId) {
      await supabaseAdmin
        .from("jarvis_github_requests")
        .update({ status: "failed", error: message })
        .eq("id", auditId);
    }
    throw new Error(`GitHub vazifasi yaratilmadi: ${message}`);
  }

  const issue = (await response.json()) as {
    number?: number;
    html_url?: string;
    id?: number;
  };
  const issueNumber = Number(issue.number || 0);
  const url = String(
    issue.html_url || `https://github.com/${config.repository}/issues/${issueNumber}`,
  );
  if (auditId) {
    await supabaseAdmin
      .from("jarvis_github_requests")
      .update({
        status: mode === "copilot_pr" ? "copilot_queued" : "issue_created",
        github_issue_number: issueNumber || null,
        github_external_id: issue.id ? String(issue.id) : null,
        github_url: url,
        error: warning ?? null,
      })
      .eq("id", auditId);
  }

  return { ok: true, mode, issueNumber, url, repository: config.repository, warning };
}
