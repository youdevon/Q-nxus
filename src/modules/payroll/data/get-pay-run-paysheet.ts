import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/src/lib/format";
import { resolvePayrollOrganization } from "@/src/modules/payroll/lib/resolve-payroll-organization";
import { payRunStatusLabel } from "@/src/modules/payroll/lib/pay-run-lifecycle";
import { isPayslipIncludedInRun } from "@/src/modules/payroll/lib/pay-run-membership";
import { roundToCents } from "@/src/modules/payroll/lib/money";
import {
  buildPaysheetWorkbookData,
  type PayRunPaysheetWorkbookData,
} from "@/src/modules/payroll/lib/paysheet-export-data";
import { extractEmployerNisFromSnapshot } from "@/src/modules/payroll/lib/statutory-remittance";

export type { PayRunPaysheetWorkbookData };

export type PayRunPaysheetRow = {
  employeeNumber: string;
  employeeName: string;
  departmentName: string | null;
  jobTitle: string | null;
  baseSalary: number;
  allowancesTotal: number;
  grossPay: number;
  paye: number;
  nisEmployee: number;
  healthSurcharge: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  /** Employer NIS cost — not deducted from net pay. */
  nisEmployer: number;
  /** Employee + employer NIS — total NIS payment for the period. */
  nisPayment: number;
  status: "DRAFT" | "EXCLUDED" | "POSTED";
  isExcluded: boolean;
  exclusionReason: string | null;
};

export type PayRunPaysheetData = {
  payRunId: string;
  runNumber: string;
  status: string;
  statusLabel: string;
  runKind: "REGULAR" | "CORRECTION" | "OFF_CYCLE";
  currency: string;
  organizationName: string;
  periodName: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  isPreview: boolean;
  includedCount: number;
  excludedCount: number;
  rows: PayRunPaysheetRow[];
  excludedRows: PayRunPaysheetRow[];
  totals: {
    baseSalary: number;
    allowancesTotal: number;
    grossPay: number;
    paye: number;
    nisEmployee: number;
    healthSurcharge: number;
    otherDeductions: number;
    totalDeductions: number;
    netPay: number;
    nisEmployer: number;
    nisPayment: number;
  };
};

function money(value: { toString(): string } | number | null | undefined): number {
  if (value == null) {
    return 0;
  }
  return roundToCents(Number(value.toString()));
}

type PayslipSelectRow = {
  id: string;
  status: "DRAFT" | "EXCLUDED" | "POSTED";
  exclusionReason: string | null;
  employeeNumber: string;
  employeeName: string;
  departmentName: string | null;
  jobTitle: string | null;
  baseSalary: { toString(): string } | null;
  allowancesTotal: { toString(): string } | null;
  grossPay: { toString(): string } | null;
  payeAmount: { toString(): string } | null;
  nisEmployeeAmount: { toString(): string } | null;
  healthSurchargeAmount: { toString(): string } | null;
  totalDeductions: { toString(): string } | null;
  netPay: { toString(): string } | null;
  snapshot: unknown;
};

function mapPayslipRows(payslips: PayslipSelectRow[]): PayRunPaysheetRow[] {
  return payslips.map((slip) => {
    const paye = money(slip.payeAmount);
    const nisEmployee = money(slip.nisEmployeeAmount);
    const healthSurcharge = money(slip.healthSurchargeAmount);
    const totalDeductions = money(slip.totalDeductions);
    const statutoryTotal = roundToCents(paye + nisEmployee + healthSurcharge);
    const otherDeductions = roundToCents(
      Math.max(0, totalDeductions - statutoryTotal),
    );

    const nisEmployer = extractEmployerNisFromSnapshot(slip.snapshot);

    return {
      employeeNumber: slip.employeeNumber,
      employeeName: slip.employeeName,
      departmentName: slip.departmentName,
      jobTitle: slip.jobTitle,
      baseSalary: money(slip.baseSalary),
      allowancesTotal: money(slip.allowancesTotal),
      grossPay: money(slip.grossPay),
      paye,
      nisEmployee,
      healthSurcharge,
      otherDeductions,
      totalDeductions,
      netPay: money(slip.netPay),
      nisEmployer,
      nisPayment: roundToCents(nisEmployee + nisEmployer),
      status: slip.status,
      isExcluded: !isPayslipIncludedInRun(slip.status),
      exclusionReason: slip.exclusionReason,
    };
  });
}

function buildPaysheetDataFromRun(
  run: {
    id: string;
    runNumber: string;
    status: string;
    runKind: "REGULAR" | "CORRECTION" | "OFF_CYCLE";
    currency: string;
    payrollPeriod: {
      name: string;
      periodKey: string;
      periodStart: Date;
      periodEnd: Date;
    };
  },
  organizationName: string,
  payslips: PayslipSelectRow[],
): PayRunPaysheetData {
  const mapped = mapPayslipRows(payslips);
  const rows = mapped.filter((row) => !row.isExcluded);
  const excludedRows = mapped.filter((row) => row.isExcluded);

  const totals = rows.reduce(
    (acc, row) => ({
      baseSalary: roundToCents(acc.baseSalary + row.baseSalary),
      allowancesTotal: roundToCents(acc.allowancesTotal + row.allowancesTotal),
      grossPay: roundToCents(acc.grossPay + row.grossPay),
      paye: roundToCents(acc.paye + row.paye),
      nisEmployee: roundToCents(acc.nisEmployee + row.nisEmployee),
      healthSurcharge: roundToCents(acc.healthSurcharge + row.healthSurcharge),
      otherDeductions: roundToCents(acc.otherDeductions + row.otherDeductions),
      totalDeductions: roundToCents(acc.totalDeductions + row.totalDeductions),
      netPay: roundToCents(acc.netPay + row.netPay),
      nisEmployer: roundToCents(acc.nisEmployer + row.nisEmployer),
      nisPayment: roundToCents(acc.nisPayment + row.nisPayment),
    }),
    {
      baseSalary: 0,
      allowancesTotal: 0,
      grossPay: 0,
      paye: 0,
      nisEmployee: 0,
      healthSurcharge: 0,
      otherDeductions: 0,
      totalDeductions: 0,
      netPay: 0,
      nisEmployer: 0,
      nisPayment: 0,
    },
  );

  const isPreview = run.status === "DRAFT" || run.status === "APPROVED";

  return {
    payRunId: run.id,
    runNumber: run.runNumber,
    status: run.status,
    statusLabel: payRunStatusLabel(run.status),
    runKind: run.runKind,
    currency: run.currency,
    organizationName,
    periodName: run.payrollPeriod.name,
    periodKey: run.payrollPeriod.periodKey,
    periodStart: run.payrollPeriod.periodStart.toISOString().slice(0, 10),
    periodEnd: run.payrollPeriod.periodEnd.toISOString().slice(0, 10),
    isPreview,
    includedCount: rows.length,
    excludedCount: excludedRows.length,
    rows,
    excludedRows,
    totals,
  };
}

/**
 * Classic payroll register / paysheet for a pay run — available in any status
 * (draft, approved, posted) so officers can review breakdowns before approval.
 */
export async function getPayRunPaysheet(
  payRunId: string,
  options?: { actorUserId?: string | null },
): Promise<PayRunPaysheetData | null> {
  const organization = await resolvePayrollOrganization({
    actorUserId: options?.actorUserId,
  });

  const run = await prisma.payRun.findFirst({
    where: { id: payRunId, organizationId: organization.id },
    select: {
      id: true,
      runNumber: true,
      status: true,
      runKind: true,
      currency: true,
      payrollPeriod: {
        select: {
          name: true,
          periodKey: true,
          periodStart: true,
          periodEnd: true,
        },
      },
      payslips: {
        orderBy: [{ employeeNumber: "asc" }, { employeeName: "asc" }],
        select: {
          id: true,
          status: true,
          exclusionReason: true,
          employeeNumber: true,
          employeeName: true,
          departmentName: true,
          jobTitle: true,
          baseSalary: true,
          allowancesTotal: true,
          grossPay: true,
          payeAmount: true,
          nisEmployeeAmount: true,
          healthSurchargeAmount: true,
          totalDeductions: true,
          netPay: true,
          snapshot: true,
        },
      },
    },
  });

  if (!run) {
    return null;
  }

  return buildPaysheetDataFromRun(run, organization.name, run.payslips);
}

/** Paysheet + NIS weekly + bank rows for the multi-sheet XLSX export. */
export async function getPayRunPaysheetWorkbookData(
  payRunId: string,
  options?: { actorUserId?: string | null },
): Promise<PayRunPaysheetWorkbookData | null> {
  const organization = await resolvePayrollOrganization({
    actorUserId: options?.actorUserId,
  });

  const run = await prisma.payRun.findFirst({
    where: { id: payRunId, organizationId: organization.id },
    select: {
      id: true,
      runNumber: true,
      status: true,
      runKind: true,
      currency: true,
      payrollPeriod: {
        select: {
          name: true,
          periodKey: true,
          periodStart: true,
          periodEnd: true,
        },
      },
      payslips: {
        orderBy: [{ employeeNumber: "asc" }, { employeeName: "asc" }],
        select: {
          id: true,
          status: true,
          exclusionReason: true,
          employeeNumber: true,
          employeeName: true,
          departmentName: true,
          jobTitle: true,
          baseSalary: true,
          allowancesTotal: true,
          grossPay: true,
          payeAmount: true,
          nisEmployeeAmount: true,
          healthSurchargeAmount: true,
          totalDeductions: true,
          netPay: true,
          snapshot: true,
        },
      },
    },
  });

  if (!run) {
    return null;
  }

  const paysheet = buildPaysheetDataFromRun(run, organization.name, run.payslips);

  return buildPaysheetWorkbookData({
    paysheet,
    snapshots: run.payslips
      .filter((slip) => isPayslipIncludedInRun(slip.status))
      .map((slip) => ({
        employeeNumber: slip.employeeNumber,
        employeeName: slip.employeeName,
        netPay: money(slip.netPay),
        snapshot: slip.snapshot,
      })),
  });
}

export function formatPaysheetMoney(
  amount: number,
  currency: string,
): string {
  return formatMoney(amount, { currency });
}
