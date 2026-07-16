/**
 * Assembles a single-period payslip preview from contract earnings,
 * statutory configs, and bank split rules (client-safe).
 *
 * Phase 1 period = one calendar month. Contract base salary is treated as
 * monthly; allowances are normalised to monthly equivalents and treated as
 * non-taxable.
 */

import type { HealthSurchargeResult } from "@/src/modules/payroll/lib/health-surcharge";
import {
  computeHealthSurcharge,
  type HealthSurchargeConfigInput,
} from "@/src/modules/payroll/lib/health-surcharge";
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
import {
  bankFixedAmountTotal,
  type PayrollReadinessResult,
} from "@/src/modules/payroll/lib/payroll-readiness";

export type PayslipLineItem = {
  label: string;
  amount: number;
  /** Optional detail shown under the label (e.g. class code, weekly rate). */
  detail?: string;
};

export type PayslipBankLine = {
  bankName: string;
  accountNumberMasked: string;
  amount: number;
  kind: "FIXED" | "REMAINDER";
};

export type PayslipEarningInput = {
  label: string;
  /** Amount at the stated source frequency. */
  amount: number;
  frequency: string;
  isTaxable: boolean;
  source: "CONTRACT_SALARY" | "CONTRACT_ALLOWANCE";
};

export type PayslipBankAccountInput = {
  bankName: string;
  accountNumber: string;
  amount: number | null;
  isPrimary: boolean;
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
  earnings: PayslipEarningInput[];
  bankAccounts: PayslipBankAccountInput[];
  readiness: PayrollReadinessResult;
  td1OtherApprovedAnnual?: number;
  pensionOnlyIncome?: boolean;
  nisClasses: NisEarningsClassInput[];
  payeConfig: PayeTaxConfigInput | null;
  healthConfig: HealthSurchargeConfigInput | null;
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
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
      return roundMoney((amount * 52) / 12);
    case "BIWEEKLY":
      return roundMoney((amount * 26) / 12);
    case "FORTNIGHTLY":
      return roundMoney((amount * 26) / 12);
    case "SEMI_MONTHLY":
      return roundMoney(amount * 2);
    case "ANNUAL":
      return roundMoney(amount / 12);
    case "ONE_TIME":
      return 0;
    case "MONTHLY":
    case "PER_PAY_PERIOD":
    default:
      return roundMoney(amount);
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

  let remainingCents = Math.round(
    Math.max(0, input.availableAfterStatutory) * 100,
  );
  const deductions: PayslipLineItem[] = [];
  const lines: PayslipBankLine[] = [];

  for (const account of secondaries) {
    const fixedCents = Math.round(Math.max(0, account.amount ?? 0) * 100);
    if (fixedCents <= 0) {
      continue;
    }

    const paidCents = Math.min(fixedCents, remainingCents);
    remainingCents -= paidCents;
    const paidAmount = paidCents / 100;

    deductions.push({
      label: `Bank transfer — ${account.bankName}`,
      amount: paidAmount,
      detail: maskAccountNumber(account.accountNumber),
    });

    lines.push({
      bankName: account.bankName,
      accountNumberMasked: maskAccountNumber(account.accountNumber),
      amount: paidAmount,
      kind: "FIXED",
    });
  }

  const fixedTotal = bankFixedAmountTotal(input.accounts);
  if (fixedTotal > input.availableAfterStatutory + Number.EPSILON) {
    warnings.push(
      `Secondary bank fixed amounts (${fixedTotal.toFixed(2)}) exceed pay remaining after statutory deductions (${input.availableAfterStatutory.toFixed(2)}). Primary remainder is zero.`,
    );
  }

  const primaryRemainder = remainingCents / 100;

  lines.push({
    bankName: primary.bankName,
    accountNumberMasked: maskAccountNumber(primary.accountNumber),
    amount: primaryRemainder,
    kind: "REMAINDER",
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
  const asOfIso = asOf.toISOString().slice(0, 10);
  const warnings: string[] = [...input.readiness.blockingIssues];
  const notes: string[] = [
    "Preview only — not a posted pay run.",
    "Phase 1 taxable pay uses current contract base salary only; allowances remain visible in gross pay but are excluded from statutory deductions.",
    "Overtime, bonuses, and commissions are deferred from this preview.",
  ];

  const earnings: PayslipLineItem[] = [];
  let baseSalary = 0;
  let allowancesTotal = 0;
  let grossPay = 0;
  let monthlyTaxableEarnings = 0;

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
      detail:
        element.source === "CONTRACT_ALLOWANCE" &&
        element.frequency.toUpperCase() !== "MONTHLY"
          ? `${frequencyLabel(element.frequency)} → monthly equivalent`
          : element.isTaxable
            ? undefined
            : "Non-taxable",
    });

    grossPay = roundMoney(grossPay + periodAmount);
    if (element.source === "CONTRACT_SALARY") {
      baseSalary = roundMoney(baseSalary + periodAmount);
      monthlyTaxableEarnings = roundMoney(
        monthlyTaxableEarnings + periodAmount,
      );
    } else {
      allowancesTotal = roundMoney(allowancesTotal + periodAmount);
    }
  }

  let nis: NisContributionResult | null = null;
  let paye: PayeContributionResult | null = null;
  let health: HealthSurchargeResult | null = null;

  if (monthlyTaxableEarnings > 0) {
    if (input.nisClasses.length > 0) {
      nis = computeNisContribution({
        monthlySalary: monthlyTaxableEarnings,
        classes: input.nisClasses,
      });
    } else {
      warnings.push("No active NIS earnings classes configured.");
    }

    if (input.payeConfig != null) {
      paye = computePayeContribution({
        monthlyTaxableEarnings,
        config: input.payeConfig,
        employeeNisWeekly: nis?.employeeWeekly ?? 0,
        otherApprovedDeductionsAnnual: input.td1OtherApprovedAnnual ?? 0,
      });
    } else {
      warnings.push("No active PAYE tax config configured.");
    }

    if (input.healthConfig != null) {
      health = computeHealthSurcharge({
        config: input.healthConfig,
        monthlyEarnings: monthlyTaxableEarnings,
        dateOfBirth: input.employee.dateOfBirth,
        pensionOnlyIncome: input.pensionOnlyIncome ?? false,
        asOf,
        // Monthly average uses weeksInPeriod=1 for weekly; we use averageMonthlyAmount.
        weeksInPeriod: 1,
      });

      if (!input.employee.dateOfBirth) {
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
      detail: `Class ${nis.classCode} · ${nis.employeeWeekly.toFixed(2)}/wk × 4⅓`,
    });
  } else if (nis?.belowMinimum) {
    notes.push("NIS: earnings below Class I floor — no employee contribution.");
  }

  if (paye) {
    deductions.push({
      label: "PAYE (income tax)",
      amount: paye.monthlyPaye,
      detail: `Annual tax ${paye.annualTax.toFixed(2)} ÷ 12`,
    });
  }

  if (health && !health.exempt) {
    deductions.push({
      label: "Health Surcharge",
      amount: health.averageMonthlyAmount,
      detail: `${health.weeklyAmount.toFixed(2)}/wk · ${health.tier.toLowerCase()} tier · monthly average`,
    });
  } else if (health?.exempt) {
    notes.push(
      `Health Surcharge exempt (${(health.exemptionReason ?? "unknown").replaceAll("_", " ").toLowerCase()}).`,
    );
  }

  const statutoryDeductionsTotal = roundMoney(
    deductions.reduce((sum, line) => sum + line.amount, 0),
  );
  const availableAfterStatutory = roundMoney(
    grossPay - statutoryDeductionsTotal,
  );

  let bankDistribution: PayslipBankLine[] | null = null;

  if (input.paymentMethod === "BANK_TRANSFER" && input.bankAccounts.length > 0) {
    const allocated = applyFixedBankAllocations({
      availableAfterStatutory,
      accounts: input.bankAccounts,
    });
    deductions.push(...allocated.deductions);
    bankDistribution = allocated.lines;
    warnings.push(...allocated.warnings);
  } else if (input.paymentMethod === "BANK_TRANSFER") {
    warnings.push("No bank accounts on file for net pay distribution.");
  }

  const totalDeductions = roundMoney(
    deductions.reduce((sum, line) => sum + line.amount, 0),
  );
  const netPay = roundMoney(grossPay - totalDeductions);

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
