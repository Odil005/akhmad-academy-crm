import { isGitHubChangeCommand } from "./github";

export type JarvisRole = "director" | "admin" | "teacher" | "student";
export type DirectJarvisIntent =
  "unread_messages" | "system_health" | "repair_queues" | "github_change_request";

const ADMIN_ONLY_TOOLS = new Set([
  "create_github_change_request",
  "list_system_settings",
  "update_system_setting",
]);

const MANAGER_TOOLS = new Set([
  "search_students",
  "list_teachers",
  "create_subject",
  "create_group",
  "create_student",
  "create_lead",
  "assign_student_to_group",
  "assign_teacher_to_group",
  "repair_system_queues",
  "system_health",
]);

const MUTATING_TOOLS = new Set([
  "create_subject",
  "create_group",
  "create_student",
  "create_lead",
  "create_methodology",
  "assign_student_to_group",
  "assign_teacher_to_group",
  "send_parent_message",
  "repair_system_queues",
  "create_github_change_request",
  "update_system_setting",
]);


export function isJarvisMutatingTool(tool: string): boolean {
  return MUTATING_TOOLS.has(tool);
}

export function canUseJarvisTool(roles: JarvisRole[], tool: string): boolean {
  const isManager = roles.includes("director") || roles.includes("admin");
  const isTeacher = roles.includes("teacher");
  if (ADMIN_ONLY_TOOLS.has(tool)) return roles.includes("admin");
  if (MANAGER_TOOLS.has(tool)) return isManager;
  if (tool === "send_parent_message") return isManager || isTeacher;
  return isManager || isTeacher;
}

export function isExplicitJarvisAction(text: string, tool: string): boolean {
  const normalized = text.toLocaleLowerCase("uz-UZ");
  if (
    /(qanday|qanaqa|mumkinmi|kerakmi|qilsam bo['‘’`]?ladimi|nima deysan|tushuntir|ko['‘’`]?rsatib ber)/i.test(
      normalized,
    )
  ) {
    return false;
  }
  if (tool === "send_parent_message") {
    return /(yubor|jo['‘’`]?nat|xabar ber|ogohlantir)/i.test(normalized);
  }
  if (tool === "repair_system_queues") {
    return /(tuzat|tikla|qayta urin|qayta yubor|repair|fix)/i.test(normalized);
  }
  if (tool === "create_github_change_request") {
    return isGitHubChangeCommand(normalized);
  }
  if (tool === "update_system_setting") {
    return /(sozla|o['‘’`]?zgartir|yangila|saqla|belgila|almashtir)/i.test(normalized);
  }
  return /(yarat|qo['‘’`]?sh|biriktir|tayinla|saqla)/i.test(normalized);
}

export function getDirectJarvisIntent(text: string): DirectJarvisIntent | null {
  const normalized = text.toLocaleLowerCase("uz-UZ").replaceAll("’", "'").trim();
  if (
    /(tizim|nosozlik|navbat).*(tuzat|tikla|qayta urin|qayta yubor|repair|fix)/i.test(normalized)
  ) {
    return "repair_queues";
  }
  if (/(tizim|server|nosozlik).*(tekshir|holat|ishlayaptimi|xato bormi)/i.test(normalized)) {
    return "system_health";
  }
  if (/(xabar|telegram).*(bormi|kelgan|keldi|tekshir)/i.test(normalized)) {
    return "unread_messages";
  }
  if (isGitHubChangeCommand(normalized)) return "github_change_request";
  return null;
}

export function getLocalJarvisReply(text: string): string | null {
  const normalized = text.toLocaleLowerCase("uz-UZ").replaceAll("’", "'").trim();
  if (/^(salom|assalomu alaykum|assalom|hello|hi)(\s+jarvis)?[!.?]*$/i.test(normalized)) {
    return "Assalomu alaykum! Yaxshimisiz? Men tayyorman — savolingizni yozing yoki CRM bo'yicha vazifa bering.";
  }
  if (/^(rahmat|katta rahmat|tashakkur)[!.?]*$/i.test(normalized)) {
    return "Arzimaydi! Yana nima yordam kerak?";
  }
  if (/(sen kimsan|isming nima|o'zing kimsan|nima qila olasan)/i.test(normalized)) {
    return "Men Jarvisman — Akhmad Academy CRM ichidagi AI yordamchi. Savollarga javob beraman, tizim holatini tekshiraman, ma'lumotlarni topaman va ruxsat berilgan CRM ishlarini bajaraman.";
  }
  return null;
}
