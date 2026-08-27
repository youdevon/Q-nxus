/**
 * Assembles a single-period payslip preview from contract earnings,
 * statutory configs, and bank split rules (client-safe).
 *
 * Period = one calendar month. Contract base salary is treated as monthly;
 * allowances are normalised to monthly equivalents. Taxable pay includes
 * base salary plus any contract allowance / variable earning with isTaxable.
 */

import type { HealthSurchargeResult } from "@/src/modules/payroll/lib/health-surcharge";
import {
  computeHealthSurcharge,
  type HealthSurchargeConfigInput,
} from "@/src/modules/payroll/lib/health-surcharge";
import { countMondaysInRange } from "@/src/modules/payroll/lib/contribution-weeks";
import type { NisContributionResult } from "@/src/modules/payroll/lib/nis-contribution";
import {
  computeNisContribution,
  type NisEarningsClassInput,
} from "@/src/modules/payroll/lib/nis-contribution";
import type { PayeContributionResult } from "@/src/modules/payroll/lib/paye-contribution";
import {
  computePayeContribution,
  type PayeTaxConfigInput,
} from "@/src/modules/payroll/lib/paye-contribution";
import { computeCumulativePayeContribution } from "@/src/modules/payroll/lib/cumulative-paye";
import {
  computeTaxYearPeriodPaye,
  shouldUseTaxYearPeriodPaye,
  type PreviousEmploymentStatusCode,
} from "@/src/modules/payroll/lib/tax-year-period-paye";
import {
  bankFixedAmountTotal,
  type PayrollReadinessResult,
} from "@/src/modules/payroll/lib/payroll-readiness";
import { applyPostNetBankAllocations } from "@/src/modules/payroll/lib/post-net-bank-allocations";
import {
  addCents,
  fromCents,
  roundToCents,
  subCents,
  sumMoney,
  toCents,
} from "@/src/modules/payroll/lib/money";

export type PayslipLineItem = {
  label: string;
  amount: number;
  /** Optional detail shown under the label (e.g. class code, weekly rate). */
  detail?: string;
};

/** Label hints for earning lines promoted into the identity meta rows. */
const PAYSLIP_META_SALARY_HINTS = ["base salary", "salary"] as const;
const PAYSLIP_META_TRAVEL_HINTS = ["travel"] as const;
const PAYSLIP_META_PHONE_HINTS = ["phone", "telephone"] as const;

function labelMatchesHints(
  label: string,
  hints: readonly string[],
): boolean {
  const normalized = label.toLowerCase();
  return hints.some((hint) => normalized.includes(hint));
}

/** Salary / travelling / phone lines shown in meta — not again above Gross. */
export function isPayslipMetaAllowanceLine(line: PayslipLineItem): boolean {
  return (
    labelMatchesHints(line.label, PAYSLIP_META_SALARY_HINTS) ||
    labelMatchesHints(line.label, PAYSLIP_META_TRAVEL_HINTS) ||
    labelMatchesHints(line.label, PAYSLIP_META_PHONE_HINTS)
  );
}

export function findPayslipMetaAllowanceAmount(
  earnings: PayslipLineItem[],
  kind: "salary" | "travel" | "phone",
): number | undefined {
  const hints =
    kind === "salary"
      ? PAYSLIP_META_SALARY_HINTS
      : kind === "travel"
        ? PAYSLIP_META_TRAVEL_HINTS
        : PAYSLIP_META_PHONE_HINTS;
  const match = earnings.find((line) => labelMatchesHints(line.label, hints));
  return match?.amount;
}

export type PayslipBankLine = {
  bankName: string;
  accountNumber?: string;
  accountNumberMasked: string;
  amount: number;
  kind: "FIXED" | "PERCENTAGE" | "REMAINDER";
  /** SAVINGS | CHEQUING when known — used by disbursement export fallback. */
  accountType?: string | null;
};

export type PayslipEarningInput = {
  label: string;
  /** Amount at the stated source frequency. */
  amount: number;
  frequency: string;
  isTaxable: boolean;
  source: "CONTRACT_SALARY" | "CONTRACT_ALLOWANCE" | "VARIABLE_EARNING";
  detail?: string;
};

export type PayslipDeductionInput = {
  label: string;
  amount: number;
  isTaxable?: boolean;
  detail?: string;
};

export type PayslipBankAccountInput = {
  bankName: string;
  accountNumber: string;
  amount: number | null;
  isPrimary: boolean;
  /** SAVINGS | CHEQUING — carried into bankDistribution when present. */
  accountType?: string | null;
  /** Used when postNetSplitEnabled — percentage of full take-home (0–100). */
  percentage?: number | null;
  /** Used when postNetSplitEnabled. */
  allocationKind?: "FIXED" | "PERCENTAGE" | "REMAINDER";
  priority?: number;
};

export type AssemblePayslipPreviewInput = {
  employee: {
    id: string;
    employeeNumber: string;
    displayName: string;
    dateOfBirth?: string | null;
    nisNumber?: string | null;
    birNumber?: string | null;
  };
  currency: string;
  payFrequency: string;
  paymentMethod: "BANK_TRANSFER" | "CHEQUE" | "CASH";
  /** Period reference date (defaults to today). Used for period label + Health age. */
  asOf?: Date;
  periodStart?: Date;
  periodEnd?: Date;
  earnings: PayslipEarningInput[];
  deductions?: PayslipDeductionInput[];
  bankAccounts: PayslipBankAccountInput[];
  /**
   * When true, FIXED then PERCENTAGE then REMAINDER split full take-home;
   * fixed amounts are NOT payslip deductions. Default false (Phase 1 math).
   */
  postNetSplitEnabled?: boolean;
  readiness: PayrollReadinessResult;
  td1OtherApprovedAnnual?: number;
  pensionOnlyIncome?: boolean;
  exemptFromNis?: boolean;
  exemptFromHealthSurcharge?: boolean;
  exemptFromPaye?: boolean;
  nisClasses: NisEarningsClassInput[];
  payeConfig: PayeTaxConfigInput | null;
  healthConfig: HealthSurchargeConfigInput | null;
  /** Phase 4–5 / tax-year projection: cumulative or hire-aware PAYE. */
  cumulativePaye?: {
    enabled: boolean;
    currentEmployerTaxableYtd: number;
    currentEmployerPayePaidYtd: number;
    currentEmployerNisPaidYtd: number;
    priorTaxableYtd: number;
    priorPayePaidYtd: number;
    priorNisEmployeeYtd: number;
    priorOtherApprovedYtd: number;
    /** @deprecated Prefer tax-year projection; kept for legacy cumulative. */
    monthsElapsed: number;
    taxYear?: number;
    employmentStartDate?: Date | null;
    employmentEndDate?: Date | null;
    previousEmploymentStatus?: PreviousEmploymentStatusCode | null;
    recognizePriorEmployment?: boolean;
    personalAllowanceOverride?: number | null;
    td1Submitted?: boolean;
    birDirectionPresent?: boolean;
  };
  /** Phase 6: treat non-taxable earnings explicitly (default uses isTaxable). */
  taxTreatmentNotes?: string[];
  /** Phase 7: absolute period overrides after computed statutory. */
  statutoryOverrides?: {
    payeAmount?: number | null;
    nisEmployeeAmount?: number | null;
    healthSurchargeAmount?: number | null;
    reason?: string | null;
  };
  /** Extra calc notes from tax profile / prior employment resolve. */
  taxCalcNotes?: string[];
};

export type PayslipPreview = {
  employee: {
    id: string;
    employeeNumber: string;
    displayName: string;
    nisNumber: string | null;
    birNumber: string | null;
  };
  period: {
    label: string;
    asOf: string;
    payFrequency: string;
    paymentMethod: string;
  };
  currency: string;
  earnings: PayslipLineItem[];
  baseSalary: number;
  allowancesTotal: number;
  grossPay: number;
  monthlyTaxableEarnings: number;
  deductions: PayslipLineItem[];
  totalDeductions: number;
  netPay: number;
  employerContributions: PayslipLineItem[];
  bankDistribution: PayslipBankLine[] | null;
  nis: NisContributionResult | null;
  paye: PayeContributionResult | null;
  health: HealthSurchargeResult | null;
  readiness: PayrollReadinessResult;
  warnings: string[];
  notes: string[];
};

const PAYSLIP_PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Caveats that apply only to live / draft previews — never show on posted slips. */
export const PAYSLIP_PREVIEW_CAVEAT_NOTES = [
  "Preview only — not a posted pay run.",
  "Non-taxable allowances remain in gross pay only; taxable allowances and taxable run line items enter NIS/PAYE/Health taxable pay.",
  "Base salary and recurring allowances are pro-rated by calendar days worked when hire, termination, or contract dates fall inside the period.",
  "Health Surcharge uses contribution weeks (Mondays) in the pay period, not a 52/12 monthly average.",
] as const;

const PREVIEW_CAVEAT_NOTE_SET = new Set<string>(PAYSLIP_PREVIEW_CAVEAT_NOTES);

/**
 * Notes shown under the payslip footer. Posted slips drop preview caveats
 * (snapshots may still contain them from when the run was drafted).
 */
export function notesForPayslipDisplay(
  notes: string[],
  isOfficial: boolean,
): string[] {
  if (!isOfficial) {
    return notes;
  }

  return notes.filter((note) => !PREVIEW_CAVEAT_NOTE_SET.has(note));
}

/**
 * Line `detail` text safe to show on employee-facing payslips.
 * Hides override reasons and internal PAYE estimate audit strings.
 */
export function payslipLineDetailForDisplay(
  detail: string | undefined | null,
): string | null {
  if (detail == null) {
    return null;
  }
  const trimmed = detail.trim();
  if (!trimmed) {
    return null;
  }
  if (/^override\b/i.test(trimmed)) {
    return null;
  }
  if (/paye amount overridden/i.test(trimmed)) {
    return null;
  }
  if (/tax-year paye\b/i.test(trimmed)) {
    return null;
  }
  if (/tax-year estimate\b/i.test(trimmed)) {
    return null;
  }
  if (/^annual tax\b/i.test(trimmed)) {
    return null;
  }
  if (/employment start used for estimate/i.test(trimmed)) {
    return null;
  }
  if (/prior-employer ytd\b/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/** Convert an allowance/salary amount at its source frequency to a monthly period amount. */
export function toMonthlyPeriodAmount(
  amount: number,
  frequency: string,
): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }

  switch (frequency.toUpperCase().replaceAll(" ", "_")) {
    case "WEEKLY":
      return roundToCents((amount * 52) / 12);
    case "BIWEEKLY":
      return roundToCents((amount * 26) / 12);
    case "FORTNIGHTLY":
      return roundToCents((amount * 26) / 12);
    case "SEMI_MONTHLY":
      return roundToCents(amount * 2);
    case "ANNUAL":
      return roundToCents(amount / 12);
    case "ONE_TIME":
      return 0;
    case "MONTHLY":
    case "PER_PAY_PERIOD":
    default:
      return roundToCents(amount);
  }
}

export function maskAccountNumber(accountNumber: string): string {
  const trimmed = accountNumber.trim();
  if (trimmed.length <= 4) {
    return trimmed;
  }
  return `••••${trimmed.slice(-4)}`;
}

function getTrinidadMonthParts(referenceDate: Date): {
  year: number;
  month: number;
} {
  const parts = new Intl.DateTimeFormat("en-TT", {
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Port_of_Spain",
  }).formatToParts(referenceDate);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  return { year, month };
}

export function getPreviousPayslipPeriod(referenceDate = new Date()): string {
  let { year, month } = getTrinidadMonthParts(referenceDate);

  month -= 1;

  if (month === 0) {
    month = 12;
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getCurrentPayslipPeriod(referenceDate = new Date()): string {
  const { year, month } = getTrinidadMonthParts(referenceDate);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Default live-preview period: previous month, unless that month ends before
 * contract/hire coverage begins — then use the current month so joiners are
 * not shown a $0 slip against an active contract.
 */
export function resolveDefaultLivePayslipPeriod(input?: {
  referenceDate?: Date;
  coverageStartDate?: string | Date | null;
}): string {
  const referenceDate = input?.referenceDate ?? new Date();
  const previous = getPreviousPayslipPeriod(referenceDate);
  const current = getCurrentPayslipPeriod(referenceDate);
  const coverageStart = input?.coverageStartDate;

  if (!coverageStart) {
    return previous;
  }

  const coverageIso =
    typeof coverageStart === "string"
      ? coverageStart.slice(0, 10)
      : coverageStart.toISOString().slice(0, 10);
  const previousEnd = payslipPeriodToAsOfDate(previous);
  const previousEndIso = previousEnd?.toISOString().slice(0, 10);

  if (previousEndIso && coverageIso > previousEndIso) {
    return current;
  }

  return previous;
}

export function payslipPeriodToAsOfDate(
  period: string | null | undefined,
): Date | null {
  const match = period?.match(PAYSLIP_PERIOD_PATTERN);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;

  return new Date(Date.UTC(year, monthIndex + 1, 0, 12));
}

function periodLabel(asOf: Date): string {
  return new Intl.DateTimeFormat("en-TT", {
    month: "long",
    year: "numeric",
    timeZone: "America/Port_of_Spain",
  }).format(asOf);
}

function periodStartFromAsOf(asOf: Date): Date {
  return new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1, 12, 0, 0),
  );
}

function periodEndFromAsOf(asOf: Date): Date {
  return new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 0, 12, 0, 0),
  );
}

export function formatPayslipPeriodLabel(
  period: string | null | undefined,
): string | null {
  const asOf = payslipPeriodToAsOfDate(period);

  return asOf ? periodLabel(asOf) : null;
}

function frequencyLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Apply secondary fixed bank allocations as employee deductions and build
 * the bank distribution (fixed secondaries + primary remainder).
 *
 * When configured fixed amounts exceed pay remaining after statutory
 * deductions, secondaries are satisfied in order until funds are exhausted,
 * remainder to primary is clamped at zero, and a warning is emitted.
 */
export function applyFixedBankAllocations(input: {
  availableAfterStatutory: number;
  accounts: PayslipBankAccountInput[];
}): {
  deductions: PayslipLineItem[];
  lines: PayslipBankLine[];
  primaryRemainder: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const primary = input.accounts.find((account) => account.isPrimary);
  const secondaries = input.accounts.filter((account) => !account.isPrimary);

  if (!primary) {
    warnings.push("No primary bank account marked for remainder.");
    return {
      deductions: [],
      lines: [],
      primaryRemainder: Math.max(0, input.availableAfterStatutory),
      warnings,
    };
  }

  let remainingCents = toCents(Math.max(0, input.availableAfterStatutory));
  const deductions: PayslipLineItem[] = [];
  const lines: PayslipBankLine[] = [];

  for (const account of secondaries) {
    const fixedCents = toCents(Math.max(0, account.amount ?? 0));
    if (fixedCents <= 0) {
      continue;
    }

    const paidCents = Math.min(fixedCents, remainingCents);
    remainingCents = subCents(remainingCents, paidCents);
    const paidAmount = fromCents(paidCents);

    deductions.push({
      label: `Bank transfer — ${account.bankName}`,
      amount: paidAmount,
      detail: maskAccountNumber(account.accountNumber),
    });

    lines.push({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountNumberMasked: maskAccountNumber(account.accountNumber),
      amount: paidAmount,
      kind: "FIXED",
      accountType: account.accountType ?? null,
    });
  }

  const fixedTotal = bankFixedAmountTotal(input.accounts);
  if (fixedTotal > input.availableAfterStatutory + Number.EPSILON) {
    warnings.push(
      `Secondary bank fixed amounts (${fixedTotal.toFixed(2)}) exceed pay remaining after statutory deductions (${input.availableAfterStatutory.toFixed(2)}). Primary remainder is zero.`,
    );
  }

  const primaryRemainder = fromCents(remainingCents);

  lines.push({
    bankName: primary.bankName,
    accountNumber: primary.accountNumber,
    accountNumberMasked: maskAccountNumber(primary.accountNumber),
    amount: primaryRemainder,
    kind: "REMAINDER",
    accountType: primary.accountType ?? null,
  });

  return { deductions, lines, primaryRemainder, warnings };
}

/**
 * @deprecated Use {@link applyFixedBankAllocations} — fixed amounts are deductions.
 */
export function distributeNetToBanks(input: {
  netPay: number;
  accounts: PayslipBankAccountInput[];
}): { lines: PayslipBankLine[]; warnings: string[] } {
  const { lines, warnings } = applyFixedBankAllocations({
    availableAfterStatutory: input.netPay,
    accounts: input.accounts,
  });

  return { lines, warnings };
}

export function assemblePayslipPreview(
  input: AssemblePayslipPreviewInput,
): PayslipPreview {
  const asOf = input.asOf ?? new Date();
  const periodStart = input.periodStart ?? periodStartFromAsOf(asOf);
  const periodEnd = input.periodEnd ?? periodEndFromAsOf(asOf);
  const asOfIso = asOf.toISOString().slice(0, 10);
  const warnings: string[] = [
    ...input.readiness.blockingIssues,
    ...(input.readiness.softWarnings ?? []),
  ];
  const notes: string[] = [...PAYSLIP_PREVIEW_CAVEAT_NOTES];

  const earnings: PayslipLineItem[] = [];
  let baseSalaryCents = 0;
  let allowancesTotalCents = 0;
  let grossPayCents = 0;
  let monthlyTaxableEarningsCents = 0;

  for (const element of input.earnings) {
    const periodAmount = toMonthlyPeriodAmount(
      element.amount,
      element.frequency,
    );

    if (periodAmount <= 0 && element.source === "CONTRACT_ALLOWANCE") {
      continue;
    }

    earnings.push({
      label: element.label,
      amount: periodAmount,
      detail: element.detail
        ? element.detail
        : element.source === "CONTRACT_ALLOWANCE" &&
            element.frequency.toUpperCase() !== "MONTHLY"
          ? `${frequencyLabel(element.frequency)} → monthly equivalent`
          : element.isTaxable
            ? undefined
            : "Non-taxable",
    });

    const periodAmountCents = toCents(periodAmount);
    grossPayCents = addCents(grossPayCents, periodAmountCents);
    if (element.source === "CONTRACT_SALARY") {
      baseSalaryCents = addCents(baseSalaryCents, periodAmountCents);
      monthlyTaxableEarningsCents = addCents(
        monthlyTaxableEarningsCents,
        periodAmountCents,
      );
    } else if (element.source === "CONTRACT_ALLOWANCE") {
      allowancesTotalCents = addCents(allowancesTotalCents, periodAmountCents);
      if (element.isTaxable) {
        monthlyTaxableEarningsCents = addCents(
          monthlyTaxableEarningsCents,
          periodAmountCents,
        );
      }
    } else if (element.isTaxable) {
      monthlyTaxableEarningsCents = addCents(
        monthlyTaxableEarningsCents,
        periodAmountCents,
      );
    }
  }

  const baseSalary = fromCents(baseSalaryCents);
  const allowancesTotal = fromCents(allowancesTotalCents);
  const grossPay = fromCents(grossPayCents);
  const monthlyTaxableEarnings = fromCents(monthlyTaxableEarningsCents);

  let nis: NisContributionResult | null = null;
  let paye: PayeContributionResult | null = null;
  let health: HealthSurchargeResult | null = null;

  const exemptFromNis = input.exemptFromNis ?? false;
  const exemptFromPaye = input.exemptFromPaye ?? false;
  const exemptFromHealthSurcharge = input.exemptFromHealthSurcharge ?? false;

  if (monthlyTaxableEarnings > 0) {
    const contributionWeeks = countMondaysInRange(periodStart, periodEnd);

    if (exemptFromNis) {
      notes.push("NIS exempt (employee opt-out) — no employee or employer contribution.");
    } else if (input.nisClasses.length > 0) {
      nis = computeNisContribution({
        monthlySalary: monthlyTaxableEarnings,
        classes: input.nisClasses,
        weeksInPeriod: contributionWeeks,
      });
    } else {
      warnings.push("No active NIS earnings classes configured.");
    }

    if (exemptFromPaye) {
      notes.push("PAYE exempt (employee opt-out) — no income tax deducted.");
    } else if (input.payeConfig != null) {
      const cumulative = input.cumulativePaye;
      const taxYear =
        cumulative?.taxYear ??
        periodEnd.getUTCFullYear();
      const useTaxYearProjection =
        cumulative != null &&
        (cumulative.enabled ||
          shouldUseTaxYearPeriodPaye({
            taxCalculationMethod: cumulative.enabled
              ? "STANDARD_CUMULATIVE"
              : "STANDARD_NON_CUMULATIVE",
            cumulativeCalculationEnabled: cumulative.enabled,
            employmentStartDate: cumulative.employmentStartDate,
            taxYear,
          }));

      if (useTaxYearProjection && cumulative) {
        const taxYearPaye = computeTaxYearPeriodPaye({
          taxYear,
          periodStart,
          periodEnd,
          employmentStartDate: cumulative.employmentStartDate ?? null,
          employmentEndDate: cumulative.employmentEndDate ?? null,
          config: input.payeConfig,
          personalAllowanceOverride: cumulative.personalAllowanceOverride,
          periodTaxableEarnings: monthlyTaxableEarnings,
          currentEmployerTaxableYtdBefore: cumulative.currentEmployerTaxableYtd,
          currentEmployerPayePaidYtdBefore: cumulative.currentEmployerPayePaidYtd,
          priorTaxableYtd: cumulative.priorTaxableYtd,
          priorPayePaidYtd: cumulative.priorPayePaidYtd,
          previousEmploymentStatus: cumulative.previousEmploymentStatus,
          recognizePriorEmployment:
            cumulative.recognizePriorEmployment ??
            (cumulative.priorTaxableYtd > 0 || cumulative.priorPayePaidYtd > 0),
          employeeNisWeekly: nis?.employeeWeekly ?? 0,
          nisEmployeePaidYtdBefore:
            cumulative.currentEmployerNisPaidYtd +
            cumulative.priorNisEmployeeYtd,
          periodNisEmployee: nis && !nis.belowMinimum ? nis.employeeMonthly : 0,
          otherApprovedDeductionsAnnual: input.td1OtherApprovedAnnual ?? 0,
          priorOtherApprovedYtd: cumulative.priorOtherApprovedYtd,
          td1Submitted: cumulative.td1Submitted,
          birDirectionPresent: cumulative.birDirectionPresent,
        });
        paye = taxYearPaye;
        notes.push(
          `Tax-year PAYE · ${taxYearPaye.remainingPeriodsIncludingThis} period${taxYearPaye.remainingPeriodsIncludingThis === 1 ? "" : "s"} remaining (incl. this) · estimated annual taxable ${taxYearPaye.projectedAnnualTaxable.toFixed(2)} · annual tax ${taxYearPaye.annualTax.toFixed(2)} − paid ${taxYearPaye.payePaidYtdBefore.toFixed(2)} → ${taxYearPaye.periodPaye.toFixed(2)}.`,
        );
        if (taxYearPaye.explain.employmentStartUsed) {
          notes.push(
            `Employment start used for estimate: ${taxYearPaye.explain.employmentStartUsed} (months before hire are not annualized).`,
          );
        }
        for (const warning of taxYearPaye.warnings) {
          warnings.push(warning);
        }
        if (taxYearPaye.payePositionStatus !== "NORMAL") {
          notes.push(`PAYE position: ${taxYearPaye.payePositionStatus}.`);
        }
      } else if (cumulative?.enabled) {
        const cumulativePaye = computeCumulativePayeContribution({
          periodTaxableEarnings: monthlyTaxableEarnings,
          currentEmployerTaxableYtd: cumulative.currentEmployerTaxableYtd,
          currentEmployerPayePaidYtd: cumulative.currentEmployerPayePaidYtd,
          priorTaxableYtd: cumulative.priorTaxableYtd,
          priorPayePaidYtd: cumulative.priorPayePaidYtd,
          monthsElapsed: cumulative.monthsElapsed,
          config: input.payeConfig,
          employeeNisWeekly: nis?.employeeWeekly ?? 0,
          nisEmployeePaidYtdBefore:
            cumulative.currentEmployerNisPaidYtd +
            cumulative.priorNisEmployeeYtd,
          periodNisEmployee: nis && !nis.belowMinimum ? nis.employeeMonthly : 0,
          otherApprovedDeductionsAnnual: input.td1OtherApprovedAnnual ?? 0,
          priorOtherApprovedYtd: cumulative.priorOtherApprovedYtd,
        });
        paye = cumulativePaye;
        notes.push(
          `Cumulative PAYE · ${cumulative.monthsElapsed} month${cumulative.monthsElapsed === 1 ? "" : "s"} elapsed · tax to date ${cumulativePaye.taxToDate.toFixed(2)} − paid ${cumulativePaye.payePaidYtdBefore.toFixed(2)}.`,
        );
      } else {
        paye = computePayeContribution({
          monthlyTaxableEarnings,
          config: input.payeConfig,
          employeeNisWeekly: nis?.employeeWeekly ?? 0,
          otherApprovedDeductionsAnnual: input.td1OtherApprovedAnnual ?? 0,
        });
      }
    } else {
      warnings.push("No active PAYE tax config configured.");
    }

    if (input.healthConfig != null) {
      health = computeHealthSurcharge({
        config: input.healthConfig,
        monthlyEarnings: monthlyTaxableEarnings,
        dateOfBirth: input.employee.dateOfBirth,
        pensionOnlyIncome: input.pensionOnlyIncome ?? false,
        exemptFromHealthSurcharge,
        asOf,
        weeksInPeriod: contributionWeeks,
      });

      if (!exemptFromHealthSurcharge && !input.employee.dateOfBirth) {
        warnings.push(
          "Employee date of birth is not set — Health Surcharge age exemptions cannot be applied.",
        );
      }
    } else {
      warnings.push("No active Health Surcharge config configured.");
    }
  } else if (input.earnings.length === 0) {
    warnings.push("No earnings available to calculate a payslip.");
  }

  const deductions: PayslipLineItem[] = [];

  if (nis && !nis.belowMinimum) {
    deductions.push({
      label: "NIS (employee)",
      amount: nis.employeeMonthly,
      detail: `Class ${nis.classCode} · ${nis.employeeWeekly.toFixed(2)}/wk × ${nis.weeksInPeriod}`,
    });
  } else if (nis?.belowMinimum) {
    notes.push("NIS: earnings below Class I floor — no employee contribution.");
  }

  if (paye) {
    const taxYearMethod =
      paye && "method" in paye && paye.method === "TAX_YEAR_PROJECTION";
    const cumulativeEnabled = input.cumulativePaye?.enabled === true;
    deductions.push({
      label: "PAYE (income tax)",
      amount: paye.monthlyPaye,
      detail: taxYearMethod
        ? `Tax-year estimate ${paye.monthlyPaye.toFixed(2)}`
        : cumulativeEnabled
          ? `Cumulative period tax ${paye.monthlyPaye.toFixed(2)}`
          : `Annual tax ${paye.annualTax.toFixed(2)} ÷ 12`,
    });
  }

  if (health && !health.exempt) {
    deductions.push({
      label: "Health Surcharge",
      amount: health.periodAmount,
      detail: `${health.weeklyAmount.toFixed(2)}/wk · ${health.weeksInPeriod} contribution week${health.weeksInPeriod === 1 ? "" : "s"} · ${health.tier.toLowerCase()} tier`,
    });
  } else if (health?.exempt) {
    notes.push(
      `Health Surcharge exempt (${(health.exemptionReason ?? "unknown").replaceAll("_", " ").toLowerCase()}).`,
    );
  }

  const overrides = input.statutoryOverrides;
  if (overrides) {
    if (overrides.payeAmount != null && Number.isFinite(overrides.payeAmount)) {
      const idx = deductions.findIndex((line) => line.label === "PAYE (income tax)");
      const amount = roundToCents(Math.max(0, overrides.payeAmount));
      if (idx >= 0) {
        deductions[idx] = {
          ...deductions[idx],
          amount,
          detail: `Override${overrides.reason ? ` · ${overrides.reason}` : ""}`,
        };
      } else {
        deductions.push({
          label: "PAYE (income tax)",
          amount,
          detail: `Override${overrides.reason ? ` · ${overrides.reason}` : ""}`,
        });
      }
      notes.push("PAYE amount overridden for this period.");
    }
    if (
      overrides.nisEmployeeAmount != null &&
      Number.isFinite(overrides.nisEmployeeAmount)
    ) {
      const idx = deductions.findIndex((line) => line.label === "NIS (employee)");
      const amount = roundToCents(Math.max(0, overrides.nisEmployeeAmount));
      if (idx >= 0) {
        deductions[idx] = {
          ...deductions[idx],
          amount,
          detail: `Override${overrides.reason ? ` · ${overrides.reason}` : ""}`,
        };
      } else if (amount > 0) {
        deductions.push({
          label: "NIS (employee)",
          amount,
          detail: `Override${overrides.reason ? ` · ${overrides.reason}` : ""}`,
        });
      }
      notes.push("NIS employee amount overridden for this period.");
    }
    if (
      overrides.healthSurchargeAmount != null &&
      Number.isFinite(overrides.healthSurchargeAmount)
    ) {
      const idx = deductions.findIndex(
        (line) => line.label === "Health Surcharge",
      );
      const amount = roundToCents(Math.max(0, overrides.healthSurchargeAmount));
      if (idx >= 0) {
        deductions[idx] = {
          ...deductions[idx],
          amount,
          detail: `Override${overrides.reason ? ` · ${overrides.reason}` : ""}`,
        };
      } else if (amount > 0) {
        deductions.push({
          label: "Health Surcharge",
          amount,
          detail: `Override${overrides.reason ? ` · ${overrides.reason}` : ""}`,
        });
      }
      notes.push("Health Surcharge amount overridden for this period.");
    }
  }

  if (input.taxCalcNotes?.length) {
    notes.push(...input.taxCalcNotes);
  }
  if (input.taxTreatmentNotes?.length) {
    notes.push(...input.taxTreatmentNotes);
  }

  for (const deduction of input.deductions ?? []) {
    if (deduction.amount === 0 || !Number.isFinite(deduction.amount)) {
      continue;
    }
    deductions.push({
      label: deduction.label,
      amount: roundToCents(deduction.amount),
      detail: deduction.detail,
    });
  }

  const statutoryDeductionsTotal = sumMoney(
    ...deductions.map((line) => line.amount),
  );
  const availableAfterStatutory = fromCents(
    subCents(toCents(grossPay), toCents(statutoryDeductionsTotal)),
  );

  let bankDistribution: PayslipBankLine[] | null = null;

  if (input.paymentMethod === "BANK_TRANSFER" && input.bankAccounts.length > 0) {
    if (input.postNetSplitEnabled) {
      const instructions = input.bankAccounts.map((account, index) => {
        const kind =
          account.allocationKind ??
          (account.isPrimary
            ? ("REMAINDER" as const)
            : account.percentage != null && account.percentage > 0
              ? ("PERCENTAGE" as const)
              : ("FIXED" as const));
        return {
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          fixedAmount: kind === "FIXED" ? account.amount : null,
          percentage: kind === "PERCENTAGE" ? (account.percentage ?? null) : null,
          kind,
          priority: account.priority ?? index,
          accountType: account.accountType ?? null,
        };
      });
      const allocated = applyPostNetBankAllocations({
        availableAfterStatutory,
        accounts: instructions,
      });
      if (!allocated.ok) {
        warnings.push(allocated.error ?? "Post-net bank allocation failed.");
      } else {
        bankDistribution = allocated.lines;
        warnings.push(...allocated.warnings);
      }
    } else {
      const allocated = applyFixedBankAllocations({
        availableAfterStatutory,
        accounts: input.bankAccounts,
      });
      deductions.push(...allocated.deductions);
      bankDistribution = allocated.lines;
      warnings.push(...allocated.warnings);
    }
  } else if (input.paymentMethod === "BANK_TRANSFER") {
    warnings.push("No bank accounts on file for net pay distribution.");
  }

  const totalDeductions = sumMoney(...deductions.map((line) => line.amount));
  const netPay = fromCents(subCents(toCents(grossPay), toCents(totalDeductions)));

  const employerContributions: PayslipLineItem[] = [];
  if (nis && !nis.belowMinimum) {
    employerContributions.push({
      label: "NIS (employer)",
      amount: nis.employerMonthly,
      detail: `Class ${nis.classCode} · informational — not deducted from net`,
    });
  }

  // Deduplicate warnings while preserving order.
  const uniqueWarnings = [...new Set(warnings)];

  return {
    employee: {
      id: input.employee.id,
      employeeNumber: input.employee.employeeNumber,
      displayName: input.employee.displayName,
      nisNumber: input.employee.nisNumber?.trim() || null,
      birNumber: input.employee.birNumber?.trim() || null,
    },
    period: {
      label: periodLabel(asOf),
      asOf: asOfIso,
      payFrequency: frequencyLabel(input.payFrequency),
      paymentMethod: frequencyLabel(input.paymentMethod),
    },
    currency: input.currency,
    earnings,
    baseSalary,
    allowancesTotal,
    grossPay,
    monthlyTaxableEarnings,
    deductions,
    totalDeductions,
    netPay,
    employerContributions,
    bankDistribution,
    nis,
    paye,
    health,
    readiness: input.readiness,
    warnings: uniqueWarnings,
    notes,
  };
}
