export type JarvisRole = "director" | "admin" | "teacher" | "student";

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
  "assign_student_to_group",
  "assign_teacher_to_group",
  "send_parent_message",
  "repair_system_queues",
]);

export function isJarvisMutatingTool(tool: string): boolean {
  return MUTATING_TOOLS.has(tool);
}

export function canUseJarvisTool(roles: JarvisRole[], tool: string): boolean {
  const isManager = roles.includes("director") || roles.includes("admin");
  const isTeacher = roles.includes("teacher");
  if (MANAGER_TOOLS.has(tool)) return isManager;
  if (tool === "send_parent_message") return isManager || isTeacher;
  return isManager || isTeacher;
}

export function isExplicitJarvisAction(text: string, tool: string): boolean {
  const normalized = text.toLocaleLowerCase("uz-UZ");
  if (tool === "send_parent_message") {
    return /(yubor|jo['‘’`]?nat|xabar ber|ogohlantir)/i.test(normalized);
  }
  if (tool === "repair_system_queues") {
    return /(tuzat|tikla|qayta urin|qayta yubor|repair|fix)/i.test(normalized);
  }
  return /(yarat|qo['‘’`]?sh|biriktir|tayinla|saqla)/i.test(normalized);
}
