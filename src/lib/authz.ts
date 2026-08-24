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

/** Staff (admin or director) may manage all account roles, including director logins. */
export function canManageAccount(roles: readonly string[], targetRole: AppRole) {
  return isStaff(roles) && APP_ROLES.includes(targetRole);
}

export function manageableAccountRoles(roles: readonly string[]): AppRole[] {
  return isStaff(roles) ? [...APP_ROLES] : [];
}

export function canManageSchedule(roles: readonly string[]) {
  return isStaff(roles);
}
