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

/**
 * Stable database/payroll join key for a board payee.
 * It is intentionally not presented as an employee or file number.
 */
export function formatInternalBoardReference(
  value: number,
  minimumLength = 4,
): string {
  return `BRD-${String(value).padStart(Math.max(4, minimumLength), "0")}`;
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

/**
 * Board payee accent — teal, distinct from employee primary blue and
 * leadership role washes (amber / sky / emerald).
 */
export const BOARD_MEMBER_UI = {
  button:
    "border-teal-600/30 bg-teal-600 text-white shadow-sm hover:bg-teal-600/90 focus-visible:border-teal-600/40 focus-visible:ring-teal-600/25 dark:border-teal-500/40 dark:bg-teal-500 dark:hover:bg-teal-500/90",
  badge:
    "border-teal-500/40 bg-teal-500/15 text-teal-800 dark:border-teal-400/40 dark:bg-teal-400/15 dark:text-teal-200",
  headerBand:
    "rounded-xl border border-teal-500/25 bg-gradient-to-r from-teal-500/35 via-teal-500/14 to-transparent px-4 py-3 sm:px-5 dark:from-teal-400/30 dark:via-teal-400/12",
  icon: "text-teal-700 dark:text-teal-300",
} as const;
