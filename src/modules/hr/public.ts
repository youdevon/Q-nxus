/**
 * HR public façade — stable imports for cross-module consumers (especially payroll).
 *
 * Source-of-truth map:
 * - Employee.dateOfBirth, hireDate, NIS/BIR → `hr.employees` (HR employee form)
 * - Job title / department labels → live employee seat + position assignment
 * - Payroll flags (NIS exempt, Class Z benefit, etc.) → `PayrollProfile`
 * - TD1 / tax method → `EmployeeTaxProfile`
 *
 * Prefer `@/src/modules/hr/public` over deep paths under `lib/` / `data/`.
 */

export { ageFromDateOfBirth, ageInFullYears } from "@/src/lib/age";

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
