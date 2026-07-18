/**
 * Client-safe workforce category helpers.
 * Mirrors the Prisma `WorkforceCategory` enum without importing Prisma
 * (Prisma must not ship to the browser via form components).
 */

export const WorkforceCategory = {
  EMPLOYEE: "EMPLOYEE",
  AGENT: "AGENT",
  BOARD: "BOARD",
  CONTRACTOR: "CONTRACTOR",
} as const;

export type WorkforceCategory =
  (typeof WorkforceCategory)[keyof typeof WorkforceCategory];

export const WORKFORCE_CATEGORY_OPTIONS = [
  { value: WorkforceCategory.EMPLOYEE, label: "Employee" },
  { value: WorkforceCategory.AGENT, label: "Agent" },
  { value: WorkforceCategory.BOARD, label: "Board" },
  { value: WorkforceCategory.CONTRACTOR, label: "Contractor" },
] as const;

/** Full HR employee — files, leave, appraisals, org assignment UI. */
export function isFullEmployee(
  category: WorkforceCategory | string | null | undefined,
): boolean {
  return !category || category === WorkforceCategory.EMPLOYEE;
}

/** Non-employee payees (agent / board / contractor). */
export function isNonEmployeePayee(
  category: WorkforceCategory | string | null | undefined,
): boolean {
  return !isFullEmployee(category);
}

/** Employee-file checklist, qualifications, correspondence file UI. */
export function requiresEmployeeFile(
  category: WorkforceCategory | string | null | undefined,
): boolean {
  return isFullEmployee(category);
}

/** Short badge label for directory / profile. Null for full employees. */
export function workforceCategoryBadgeLabel(
  category: WorkforceCategory | string | null | undefined,
): string | null {
  switch (category) {
    case WorkforceCategory.AGENT:
      return "Agent";
    case WorkforceCategory.BOARD:
      return "Board";
    case WorkforceCategory.CONTRACTOR:
      return "Contractor";
    default:
      return null;
  }
}

/** Preferred contract type hint when creating an engagement for a payee. */
export function suggestedContractTypeForCategory(
  category: WorkforceCategory | string | null | undefined,
): "FIXED_TERM" | "CONSULTANCY" | "OTHER" {
  switch (category) {
    case WorkforceCategory.CONTRACTOR:
      return "CONSULTANCY";
    case WorkforceCategory.AGENT:
    case WorkforceCategory.BOARD:
      return "OTHER";
    default:
      return "FIXED_TERM";
  }
}

export function parseWorkforceCategory(
  value: string | null | undefined,
): WorkforceCategory | null {
  if (!value) {
    return null;
  }

  return Object.values(WorkforceCategory).includes(value as WorkforceCategory)
    ? (value as WorkforceCategory)
    : null;
}
