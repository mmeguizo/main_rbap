export const ROLE_HIERARCHY: Record<string, number> = {
  OFFICE_HEAD: 0,
  DIRECTORS: 1,
  VICE_PRESIDENTS: 2,
  PRESIDENTS: 3,
  ADMIN: 4,
}

export const SUPERVISOR_ROLES: Record<string, string[]> = {
  ADMIN: [],
  PRESIDENTS: [],
  VICE_PRESIDENTS: ["ADMIN", "PRESIDENTS"],
  DIRECTORS: ["VICE_PRESIDENTS"],
  OFFICE_HEAD: ["DIRECTORS"],
}

export function requiresSupervisor(role: string | undefined): boolean {
  return (SUPERVISOR_ROLES[role ?? ""] ?? []).length > 0
}

export function hasMinRole(userRole: string | undefined, minRole: number): boolean {
  return (ROLE_HIERARCHY[userRole ?? ""] ?? -1) >= minRole
}

export function canWriteOffice(
  userRole: string | undefined,
  userOfficeId: string | undefined,
  targetOfficeId: string | undefined,
): boolean {
  if (!targetOfficeId) return false
  if (hasMinRole(userRole, ROLE_HIERARCHY.PRESIDENTS)) return true
  return userOfficeId === targetOfficeId
}
