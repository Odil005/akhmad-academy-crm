/**
 * A teacher without director/admin rights lands on the teacher panel, where
 * their own groups, lessons and attendance live; the generic dashboard is a
 * student view and showed teachers "0 groups".
 */
export function isTeacherOnly(roles: readonly string[]): boolean {
  return roles.includes("teacher") && !roles.includes("director") && !roles.includes("admin");
}
