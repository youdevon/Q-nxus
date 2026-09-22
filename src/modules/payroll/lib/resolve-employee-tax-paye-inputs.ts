import type { PriorEmploymentYtdTotals } from "@/src/modules/payroll/lib/prior-employment-ytd";
import {
  emptyPriorEmploymentYtdTotals,
  priorEmploymentCalcNotes,
} from "@/src/modules/payroll/lib/prior-employment-ytd";
import type { PreviousEmploymentStatusCode } from "@/src/modules/payroll/lib/tax-year-period-paye";

/**
 * Resolve employee PAYE inputs for a tax year from EmployeeTaxProfile.
 */

export type TaxCalculationMethodCode =
  | "STANDARD_CUMULATIVE"
  | "STANDARD_NON_CUMULATIVE"
  | "PREVIOUS_INCOME_INCLUDED"
  | "MANUAL_INSTRUCTION"
  | "SPECIAL_IRD_INSTRUCTION";

export type PersonalAllowanceSourceCode =
  | "STATUTORY_DEFAULT"
  | "TD1"
  | "IRD_INSTRUCTION"
  | "MANUAL_AUTHORIZED";

export type EmployeeTaxProfileStatusCode =
  | "DRAFT"
  | "ACTIVE"
  | "SUPERSEDED"
  | "ARCHIVED";

export type OtherEmolumentIncomeStatusCode =
  | "NO_OTHER_EMOLUMENTS"
  | "HAS_OTHER_EMOLUMENTS"
  | "UNKNOWN_OTHER_EMOLUMENTS";

export type { PreviousEmploymentStatusCode };

export type EmployeeTaxProfilePayeFields = {
  taxCalculationMethod: TaxCalculationMethodCode;
  taxProfileStatus: EmployeeTaxProfileStatusCode;
  personalAllowance: number | null;
  personalAllowanceSource: PersonalAllowanceSourceCode;
  td1OtherApprovedAnnual: number | null;
  cumulativeCalculationEnabled: boolean;
  previousEmploymentStatus: PreviousEmploymentStatusCode;
  previousEmploymentDeclared: boolean;
  previousEmploymentVerified: boolean;
  otherEmolumentIncomeStatus: OtherEmolumentIncomeStatusCode;
  birDirectionPresent: boolean;
  birDirectionReference: string | null;
};

export type ResolvedEmployeeTaxPayeInputs = {
  taxYear: number;
  source: "tax_profile" | "none";
  taxCalculationMethod: TaxCalculationMethodCode;
  taxProfileStatus: EmployeeTaxProfileStatusCode | null;
  /** Annual TD1 other approved deductions used by PAYE. */
  td1OtherApprovedAnnual: number;
  /**
   * When set, replaces org PayeTaxConfig.personalAllowanceAnnual for this employee.
   */
  personalAllowanceOverride: number | null;
  personalAllowanceSource: PersonalAllowanceSourceCode;
  cumulativeCalculationEnabled: boolean;
  previousEmploymentStatus: PreviousEmploymentStatusCode;
  /** Synced: true when status is PREVIOUS_EMPLOYMENT (or ACTIVE prior rows exist). */
  previousEmploymentDeclared: boolean;
  previousEmploymentVerified: boolean;
  otherEmolumentIncomeStatus: OtherEmolumentIncomeStatusCode;
  birDirectionPresent: boolean;
  birDirectionReference: string | null;
  /**
   * True when status is UNKNOWN — consumers should treat as
   * PRIOR_EMPLOYMENT_DATA_REQUIRED (do not assume prior is zero).
   */
  priorEmploymentDataRequired: boolean;
  /** Aggregated prior-employer YTD for the tax year (Phase 3). */
  priorEmployment: PriorEmploymentYtdTotals;
  /** Calc notes for methods not yet fully implemented. */
  calcNotes: string[];
};

function declaredFromStatus(
  status: PreviousEmploymentStatusCode,
  priorRecordCount: number,
): boolean {
  return status === "PREVIOUS_EMPLOYMENT" || priorRecordCount > 0;
}

export function resolveEmployeeTaxPayeInputs(input: {
  taxYear: number;
  taxProfile: EmployeeTaxProfilePayeFields | null;
  priorEmployment?: PriorEmploymentYtdTotals | null;
}): ResolvedEmployeeTaxPayeInputs {
  const { taxYear, taxProfile } = input;
  const priorEmployment =
    input.priorEmployment ?? emptyPriorEmploymentYtdTotals();

  if (taxProfile != null) {
    const td1 =
      taxProfile.td1OtherApprovedAnnual != null
        ? Math.max(0, taxProfile.td1OtherApprovedAnnual)
        : 0;

    const personalAllowanceOverride =
      taxProfile.personalAllowance != null &&
      Number.isFinite(taxProfile.personalAllowance)
        ? Math.max(0, taxProfile.personalAllowance)
        : null;

    const previousEmploymentStatus =
      priorEmployment.recordCount > 0
        ? "PREVIOUS_EMPLOYMENT"
        : taxProfile.previousEmploymentStatus;

    const previousEmploymentDeclared = declaredFromStatus(
      previousEmploymentStatus,
      priorEmployment.recordCount,
    );

    const priorEmploymentDataRequired =
      previousEmploymentStatus === "UNKNOWN_PREVIOUS_INCOME";

    const calcNotes: string[] = [];

    if (
      taxProfile.taxCalculationMethod === "MANUAL_INSTRUCTION" ||
      taxProfile.taxCalculationMethod === "SPECIAL_IRD_INSTRUCTION"
    ) {
      calcNotes.push(
        "Tax method is manual / IRD instruction — standard PAYE estimate shown until run overrides (Phase 7).",
      );
    }

    if (priorEmploymentDataRequired) {
      calcNotes.push(
        "Previous employment status is Unknown — prior income is not assumed to be zero. Review required before relying on this PAYE estimate.",
      );
    }

    calcNotes.push(
      ...priorEmploymentCalcNotes({
        previousEmploymentDeclared,
        taxCalculationMethodIncludesPrevious:
          taxProfile.taxCalculationMethod === "PREVIOUS_INCOME_INCLUDED",
        totals: priorEmployment,
      }),
    );

    return {
      taxYear,
      source: "tax_profile",
      taxCalculationMethod: taxProfile.taxCalculationMethod,
      taxProfileStatus: taxProfile.taxProfileStatus,
      td1OtherApprovedAnnual: td1,
      personalAllowanceOverride,
      personalAllowanceSource: taxProfile.personalAllowanceSource,
      cumulativeCalculationEnabled: taxProfile.cumulativeCalculationEnabled,
      previousEmploymentStatus,
      previousEmploymentDeclared,
      previousEmploymentVerified:
        taxProfile.previousEmploymentVerified ||
        (priorEmployment.recordCount > 0 && priorEmployment.allVerified),
      otherEmolumentIncomeStatus: taxProfile.otherEmolumentIncomeStatus,
      birDirectionPresent: taxProfile.birDirectionPresent,
      birDirectionReference: taxProfile.birDirectionReference,
      priorEmploymentDataRequired,
      priorEmployment,
      calcNotes,
    };
  }

  const previousEmploymentStatus: PreviousEmploymentStatusCode =
    priorEmployment.recordCount > 0
      ? "PREVIOUS_EMPLOYMENT"
      : "UNKNOWN_PREVIOUS_INCOME";
  const previousEmploymentDeclared = declaredFromStatus(
    previousEmploymentStatus,
    priorEmployment.recordCount,
  );
  const priorEmploymentDataRequired =
    previousEmploymentStatus === "UNKNOWN_PREVIOUS_INCOME";

  const calcNotes = [
    ...(priorEmploymentDataRequired
      ? [
          "Previous employment status is Unknown — prior income is not assumed to be zero. Review required before relying on this PAYE estimate.",
        ]
      : []),
    ...priorEmploymentCalcNotes({
      previousEmploymentDeclared,
      taxCalculationMethodIncludesPrevious: false,
      totals: priorEmployment,
    }),
  ];

  return {
    taxYear,
    source: "none",
    taxCalculationMethod: "STANDARD_NON_CUMULATIVE",
    taxProfileStatus: null,
    td1OtherApprovedAnnual: 0,
    personalAllowanceOverride: null,
    personalAllowanceSource: "STATUTORY_DEFAULT",
    cumulativeCalculationEnabled: false,
    previousEmploymentStatus,
    previousEmploymentDeclared,
    previousEmploymentVerified:
      priorEmployment.recordCount > 0 && priorEmployment.allVerified,
    otherEmolumentIncomeStatus: "UNKNOWN_OTHER_EMOLUMENTS",
    birDirectionPresent: false,
    birDirectionReference: null,
    priorEmploymentDataRequired,
    priorEmployment,
    calcNotes,
  };
}

/** Apply employee personal-allowance override onto org PAYE config input. */
export function applyPersonalAllowanceOverride<
  T extends { personalAllowanceAnnual: number },
>(config: T, override: number | null | undefined): T {
  if (override == null || !Number.isFinite(override)) {
    return config;
  }

  return {
    ...config,
    personalAllowanceAnnual: Math.max(0, override),
  };
}
