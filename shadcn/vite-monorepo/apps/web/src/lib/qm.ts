import type { User } from "@/contexts/AuthContext.types"

const QUALITY_MANAGEMENT_PATTERN = /quality\s*management/i
export const WORKSPACE_MODE_KEY = "rbap_workspace_mode"
export type WorkspaceMode = "RBAP" | "QM"

const PLANNING_MONITORING_EVALUATION_PATTERN =
  /planning[,\s]+monitoring\s*(?:and\s*)?evaluation/i

/**
 * Centralized check for the Quality Management department.
 * Normalizes the seeded office name ("Quality Management") so
 * branding and navigation cannot drift from the backend predicate.
 */
export function isQualityManagementOffice(
  office: { id: string; name: string } | null | undefined
): boolean {
  return !!office?.name && QUALITY_MANAGEMENT_PATTERN.test(office.name)
}

/**
 * Centralized check for the PME / Planning, Monitoring and Evaluation
 * department. Returns false for the Quality Management name so the two
 * departments are mutually exclusive.
 */
export function isPlanningMonitoringEvaluationOffice(
  office: { id: string; name: string } | null | undefined
): boolean {
  return (
    !!office?.name &&
    PLANNING_MONITORING_EVALUATION_PATTERN.test(office.name)
  )
}

export function isQmUser(user: User | null): boolean {
  if (user?.account) {
    return user.account.workspace === "QM"
  }
  return isQualityManagementOffice(user?.office)
}

export function isPmeUser(user: User | null): boolean {
  if (user?.account) {
    return user.account.workspace === "RBAP"
  }
  return isPlanningMonitoringEvaluationOffice(user?.office)
}

/**
 * A user who may create/update/delete QOAP and QOM records: an ADMIN or a
 * member of the Quality Management office. Mirrors the backend isQmOrAdmin.
 */
export function canManageQoapQom(user: User | null): boolean {
  return isQmUser(user)
}

export function getWorkspaceMode(): WorkspaceMode {
  return localStorage.getItem(WORKSPACE_MODE_KEY) === "QM" ? "QM" : "RBAP"
}

export function canEnterQmWorkspace(user: User | null): boolean {
  if (user?.account) {
    return user.account.workspace === "QM"
  }
  return isQmUser(user)
}

export function isQmWorkspaceActive(
  user: User | null,
  mode: WorkspaceMode = getWorkspaceMode(),
): boolean {
  if (user?.account) {
    return user.account.workspace === "QM"
  }
  return mode === "QM" && canEnterQmWorkspace(user)
}
