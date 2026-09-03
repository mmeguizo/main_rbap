import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const QUALITY_MANAGEMENT_OFFICE_PATTERN = /quality\s*management/i;

const PLANNING_MONITORING_EVALUATION_PATTERN =
  /planning[,\s]+monitoring\s*(?:and\s*)?evaluation/i;

/**
 * Normalized check for the Quality Management department office name.
 * Kept in one place so branding/navigation/authorization cannot drift.
 */
export function isQualityManagementOfficeName(
  name: string | null | undefined,
): boolean {
  return typeof name === 'string' && QUALITY_MANAGEMENT_OFFICE_PATTERN.test(name);
}

/**
 * Normalized check for the PME / Planning, Monitoring and Evaluation office
 * name. Returns false for the Quality Management name so the two departments
 * are mutually exclusive.
 */
export function isPlanningMonitoringEvaluationOfficeName(
  name: string | null | undefined,
): boolean {
  return (
    typeof name === 'string' && PLANNING_MONITORING_EVALUATION_PATTERN.test(name)
  );
}

/**
 * A user operating the active QM account context. RBAP ADMIN is intentionally
 * not treated as QM; the same person needs an active QM membership.
 */
export function isQmOrAdmin(user: AuthenticatedUser): boolean {
  return user.workspace === 'QM';
}
