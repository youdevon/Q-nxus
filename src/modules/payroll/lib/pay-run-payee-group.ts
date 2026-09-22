import type { PayRunPayeeGroup } from "@/generated/prisma/client";

export const PAY_RUN_PAYEE_GROUP_OPTIONS = [
  {
    value: "EMPLOYEE" as const,
    label: "Employees",
    description: "Full employees on salary / wage payroll",
  },
  {
    value: "BOARD" as const,
    label: "Board members",
    description: "Board payees and director fees",
  },
  {
    value: "AGENT" as const,
    label: "Agents",
    description: "Agent payees",
  },
  {
    value: "CONTRACTOR" as const,
    label: "Contractors",
    description: "Contractor / consultancy payees",
  },
] as const;

export type PayRunPayeeGroupValue =
  (typeof PAY_RUN_PAYEE_GROUP_OPTIONS)[number]["value"];

/**
 * Pre–payee-group regular runs are treated as the employee run so months
 * with a legacy mixed PAY-* do not block board / agent / contractor runs.
 */
export const LEGACY_REGULAR_PAYEE_GROUP: PayRunPayeeGroupValue = "EMPLOYEE";

export function parsePayRunPayeeGroup(
  value: string | null | undefined,
): PayRunPayeeGroupValue | null {
  if (!value) {
    return null;
  }
  return (
    PAY_RUN_PAYEE_GROUP_OPTIONS.find((option) => option.value === value)
      ?.value ?? null
  );
}

/** Null (legacy) regular runs resolve to Employees for conflict + display. */
export function effectivePayRunPayeeGroup(
  value: PayRunPayeeGroup | string | null | undefined,
): PayRunPayeeGroupValue {
  return parsePayRunPayeeGroup(value ?? null) ?? LEGACY_REGULAR_PAYEE_GROUP;
}

export function payRunPayeeGroupLabel(
  value: PayRunPayeeGroup | string | null | undefined,
): string | null {
  if (value == null || value === "") {
    return PAY_RUN_PAYEE_GROUP_OPTIONS.find(
      (option) => option.value === LEGACY_REGULAR_PAYEE_GROUP,
    )!.label;
  }
  return (
    PAY_RUN_PAYEE_GROUP_OPTIONS.find((option) => option.value === value)
      ?.label ?? null
  );
}
