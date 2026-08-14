/**
 * Central role rules used by route UI and server mutations.
 * Keep privilege decisions here instead of scattering `roles.includes(...)` checks.
 */
export const APP_ROLES = ["student", "teacher", "admin", "director"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function isDirector(roles: readonly string[]) {
  return roles.includes("director");
}

export function isAdmin(roles: readonly string[]) {
  return roles.includes("admin");
}

export function isStaff(roles: readonly string[]) {
  return isDirector(roles) || isAdmin(roles);
}

/** Admin manages day-to-day users; only a director may manage privileged accounts. */
export function canManageAccount(roles: readonly string[], targetRole: AppRole) {
  if (isDirector(roles)) return true;
  return isAdmin(roles) && (targetRole === "student" || targetRole === "teacher");
}

export function manageableAccountRoles(roles: readonly string[]): AppRole[] {
  return isDirector(roles) ? [...APP_ROLES] : isAdmin(roles) ? ["student", "teacher"] : [];
}

export function canManageSchedule(roles: readonly string[]) {
  return isStaff(roles);
}
