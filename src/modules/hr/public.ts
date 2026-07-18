/**
 * HR public façade — stable imports for cross-module consumers (especially payroll).
 *
 * Prefer `@/src/modules/hr/public` over deep paths under `lib/` / `data/` so
 * internal layout can move without breaking payroll and other modules.
 */

export {
  resolveStatutoryNumber,
} from "@/src/modules/hr/lib/employee-identity";

export {
  resolveEmployeeStatutoryWriteFromPayroll,
  type StatutoryNumberPair,
} from "@/src/modules/hr/lib/employee-statutory-numbers";

export {
  resolveEmployeePositionTitle,
} from "@/src/modules/hr/lib/employee-position";

export {
  WorkforceCategory,
  WORKFORCE_CATEGORY_OPTIONS,
  isFullEmployee,
  isNonEmployeePayee,
  requiresEmployeeFile,
  parseWorkforceCategory,
  workforceCategoryBadgeLabel,
} from "@/src/modules/hr/lib/workforce-category";

export {
  assertCurrentSeatMatchesAssignment,
  currentSeatMatchesAssignment,
  CurrentSeatMismatchError,
} from "@/src/modules/hr/lib/current-seat";

export { getOrgEmployeeFileCompleteness } from "@/src/modules/hr/data/get-org-employee-file-completeness";
