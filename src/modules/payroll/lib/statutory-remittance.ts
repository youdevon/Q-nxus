/**
 * Statutory remittance aggregation — PAYE, NIS (employee + employer), and
 * Health Surcharge summed from POSTED payslip snapshots for a period.
 *
 * Source of truth: frozen `payslip.snapshot` deduction / employer
 * contribution labels (same labels used by year-end + monthly analytics).
 * Draft / EXCLUDED payslips are never included by callers of this module.
 */

import {
  addCents,
  fromCents,
  roundToCents,
  sumMoney,
  toCents,
} from "@/src/modules/payroll/lib/money";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";

export type StatutoryRemittanceRow = {
  currency: string;
  paye: number;
  nisEmployee: number;
  nisEmployer: number;
  health: number;
};

export type StatutoryRemittanceTotals = {
  currency: string;
  paye: number;
  nisEmployee: number;
  nisEmployer: number;
  health: number;
  /** PAYE + NIS (employee) + NIS (employer) + Health — total statutory outflow. */
  totalRemittance: number;
};

function deductionAmount(
  snapshot: ReturnType<typeof parsePayslipSnapshot>,
  label: string,
): number {
  const amounts =
    snapshot?.payslip.deductions
      .filter((line) => line.label === label)
      .map((line) => line.amount) ?? [];
  return sumMoney(...amounts);
}

function employerContributionAmount(
  snapshot: ReturnType<typeof parsePayslipSnapshot>,
  label: string,
): number {
  const amounts =
    snapshot?.payslip.employerContributions
      .filter((line) => line.label === label)
      .map((line) => line.amount) ?? [];
  return sumMoney(...amounts);
}

/** Employer NIS from a payslip snapshot (lines first, then NIS block fallback). */
export function extractEmployerNisFromSnapshot(snapshot: unknown): number {
  const parsed = parsePayslipSnapshot(snapshot);
  const fromLines = sumMoney(
    employerContributionAmount(parsed, "NIS (employer)"),
    employerContributionAmount(parsed, "NIS Class Z (employer)"),
  );
  if (fromLines > 0) {
    return roundToCents(fromLines);
  }

  const nis = parsed?.payslip.nis;
  if (nis?.category === "CLASS_Z" && (nis.classZEmployerMonthly ?? 0) > 0) {
    return roundToCents(nis.classZEmployerMonthly);
  }

  const monthly = nis?.employerMonthly;
  if (typeof monthly === "number" && Number.isFinite(monthly) && monthly > 0) {
    return roundToCents(monthly);
  }

  return 0;
}

/** Extract one payslip's statutory amounts from its frozen snapshot JSON. */
export function extractStatutoryRemittanceRow(
  snapshot: unknown,
  currency: string,
): StatutoryRemittanceRow {
  const parsed = parsePayslipSnapshot(snapshot);

  return {
    currency: currency || "TTD",
    paye: deductionAmount(parsed, "PAYE (income tax)"),
    nisEmployee: deductionAmount(parsed, "NIS (employee)"),
    nisEmployer: extractEmployerNisFromSnapshot(snapshot),
    health: deductionAmount(parsed, "Health Surcharge"),
  };
}

/** Group + sum statutory rows by currency (cent-exact). */
export function aggregateStatutoryRemittance(
  rows: StatutoryRemittanceRow[],
): StatutoryRemittanceTotals[] {
  const centsByCurrency = new Map<
    string,
    { paye: number; nisEmployee: number; nisEmployer: number; health: number }
  >();

  for (const row of rows) {
    const currency = row.currency || "TTD";
    const current = centsByCurrency.get(currency) ?? {
      paye: 0,
      nisEmployee: 0,
      nisEmployer: 0,
      health: 0,
    };
    current.paye = addCents(current.paye, toCents(row.paye));
    current.nisEmployee = addCents(current.nisEmployee, toCents(row.nisEmployee));
    current.nisEmployer = addCents(current.nisEmployer, toCents(row.nisEmployer));
    current.health = addCents(current.health, toCents(row.health));
    centsByCurrency.set(currency, current);
  }

  return [...centsByCurrency.entries()]
    .map(([currency, cents]) => {
      const paye = fromCents(cents.paye);
      const nisEmployee = fromCents(cents.nisEmployee);
      const nisEmployer = fromCents(cents.nisEmployer);
      const health = fromCents(cents.health);
      return {
        currency,
        paye,
        nisEmployee,
        nisEmployer,
        health,
        totalRemittance: sumMoney(paye, nisEmployee, nisEmployer, health),
      };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
