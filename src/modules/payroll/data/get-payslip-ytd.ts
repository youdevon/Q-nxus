import { prisma } from "@/lib/prisma";
import { getEmployeePriorEmploymentTotals } from "@/src/modules/payroll/data/get-employee-prior-employment";
import {
  assemblePayslipYtd,
  assemblePayslipYtdBreakdown,
  type PayslipYtdBreakdown,
  type PayslipYtdContribution,
  type PayslipYtdTotals,
  yearFromPeriodKey,
} from "@/src/modules/payroll/lib/payslip-ytd";
import type { PayslipPreview } from "@/src/modules/payroll/lib/payslip-preview";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";
import { aggregatePriorEmploymentYtd } from "@/src/modules/payroll/lib/prior-employment-ytd";

function lineAmount(payslip: PayslipPreview, label: string): number {
  return payslip.deductions
    .filter((line) => line.label === label)
    .reduce((sum, line) => sum + line.amount, 0);
}

export function payslipPreviewToYtdContribution(
  payslip: PayslipPreview,
): PayslipYtdContribution {
  return {
    grossPay: payslip.grossPay,
    totalDeductions: payslip.totalDeductions,
    netPay: payslip.netPay,
    paye: lineAmount(payslip, "PAYE (income tax)"),
    nisEmployee: lineAmount(payslip, "NIS (employee)"),
    healthSurcharge: lineAmount(payslip, "Health Surcharge"),
    taxableEarnings: payslip.monthlyTaxableEarnings,
  };
}

function toContribution(row: {
  grossPay: { toString(): string };
  totalDeductions: { toString(): string };
  netPay: { toString(): string };
  monthlyTaxableEarnings?: { toString(): string } | null;
  payeAmount?: { toString(): string } | null;
  nisEmployeeAmount?: { toString(): string } | null;
  healthSurchargeAmount?: { toString(): string } | null;
  snapshot?: unknown;
}): PayslipYtdContribution {
  const hasStatutoryColumns =
    row.payeAmount != null ||
    row.nisEmployeeAmount != null ||
    row.healthSurchargeAmount != null;

  const taxableFromColumn =
    row.monthlyTaxableEarnings != null
      ? Number(row.monthlyTaxableEarnings.toString())
      : null;

  if (hasStatutoryColumns) {
    return {
      grossPay: Number(row.grossPay.toString()),
      totalDeductions: Number(row.totalDeductions.toString()),
      netPay: Number(row.netPay.toString()),
      paye: Number(row.payeAmount?.toString() ?? 0),
      nisEmployee: Number(row.nisEmployeeAmount?.toString() ?? 0),
      healthSurcharge: Number(row.healthSurchargeAmount?.toString() ?? 0),
      taxableEarnings:
        taxableFromColumn ?? Number(row.grossPay.toString()),
    };
  }

  const snapshot = parsePayslipSnapshot(row.snapshot);
  if (snapshot) {
    return payslipPreviewToYtdContribution(snapshot.payslip);
  }

  return {
    grossPay: Number(row.grossPay.toString()),
    totalDeductions: Number(row.totalDeductions.toString()),
    netPay: Number(row.netPay.toString()),
    paye: 0,
    nisEmployee: 0,
    healthSurcharge: 0,
    taxableEarnings: taxableFromColumn ?? Number(row.grossPay.toString()),
  };
}

type PostedYtdCandidate = {
  id: string;
  employeeId: string;
  grossPay: { toString(): string };
  totalDeductions: { toString(): string };
  netPay: { toString(): string };
  monthlyTaxableEarnings: { toString(): string };
  payeAmount: { toString(): string };
  nisEmployeeAmount: { toString(): string };
  healthSurchargeAmount: { toString(): string };
  createdAt: Date;
  payrollPeriod: { periodEnd: Date };
  payRun: { postedAt: Date | null };
};

function assemblePostedYtdFromCandidates(input: {
  year: number;
  periodEnd: Date;
  postedAt: Date | null;
  createdAt: Date;
  payslipId: string;
  current: PayslipYtdContribution;
  candidates: PostedYtdCandidate[];
}): PayslipYtdTotals {
  const currentMarker = input.postedAt?.getTime() ?? input.createdAt.getTime();
  const inputEnd = input.periodEnd.getTime();

  const prior = input.candidates.filter((row) => {
    if (row.id === input.payslipId) {
      return false;
    }

    const rowEnd = row.payrollPeriod.periodEnd.getTime();
    if (rowEnd < inputEnd) {
      return true;
    }

    const rowMarker =
      row.payRun.postedAt?.getTime() ?? row.createdAt.getTime();
    return rowMarker < currentMarker;
  });

  return assemblePayslipYtd({
    year: input.year,
    priorPosted: prior.map(toContribution),
    current: input.current,
  });
}

/**
 * YTD for a posted payslip: earlier posted slips in the same calendar year
 * (by period end, then postedAt), plus this slip.
 * Same-period corrections include the earlier regular posted slip.
 */
export async function getPostedPayslipYtd(input: {
  employeeId: string;
  payslipId: string;
  year: number;
  periodEnd: Date;
  postedAt: Date | null;
  createdAt: Date;
  current: PayslipYtdContribution;
}): Promise<PayslipYtdTotals> {
  const candidates = await prisma.payslip.findMany({
    where: {
      employeeId: input.employeeId,
      status: "POSTED",
      id: { not: input.payslipId },
      payrollPeriod: {
        year: input.year,
        periodEnd: { lte: input.periodEnd },
      },
    },
    select: {
      id: true,
      employeeId: true,
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      monthlyTaxableEarnings: true,
      payeAmount: true,
      nisEmployeeAmount: true,
      healthSurchargeAmount: true,
      createdAt: true,
      payrollPeriod: {
        select: { periodEnd: true },
      },
      payRun: {
        select: { postedAt: true },
      },
    },
  });

  return assemblePostedYtdFromCandidates({
    year: input.year,
    periodEnd: input.periodEnd,
    postedAt: input.postedAt,
    createdAt: input.createdAt,
    payslipId: input.payslipId,
    current: input.current,
    candidates,
  });
}

/**
 * Batch posted YTD for many slips in the same calendar year / period end
 * (e.g. pay-run batch print). One query for all prior year slips.
 */
export async function getPostedPayslipYtdBatch(
  inputs: Array<{
    employeeId: string;
    payslipId: string;
    year: number;
    periodEnd: Date;
    postedAt: Date | null;
    createdAt: Date;
    current: PayslipYtdContribution;
  }>,
): Promise<Map<string, PayslipYtdTotals>> {
  const result = new Map<string, PayslipYtdTotals>();

  if (inputs.length === 0) {
    return result;
  }

  const year = inputs[0].year;
  const periodEnd = inputs[0].periodEnd;
  const employeeIds = [...new Set(inputs.map((row) => row.employeeId))];
  const excludeIds = inputs.map((row) => row.payslipId);

  const candidates = await prisma.payslip.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: "POSTED",
      id: { notIn: excludeIds },
      payrollPeriod: {
        year,
        periodEnd: { lte: periodEnd },
      },
    },
    select: {
      id: true,
      employeeId: true,
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      monthlyTaxableEarnings: true,
      payeAmount: true,
      nisEmployeeAmount: true,
      healthSurchargeAmount: true,
      createdAt: true,
      payrollPeriod: {
        select: { periodEnd: true },
      },
      payRun: {
        select: { postedAt: true },
      },
    },
  });

  const byEmployee = new Map<string, PostedYtdCandidate[]>();
  for (const row of candidates) {
    const list = byEmployee.get(row.employeeId) ?? [];
    list.push(row);
    byEmployee.set(row.employeeId, list);
  }

  for (const input of inputs) {
    result.set(
      input.payslipId,
      assemblePostedYtdFromCandidates({
        year: input.year,
        periodEnd: input.periodEnd,
        postedAt: input.postedAt,
        createdAt: input.createdAt,
        payslipId: input.payslipId,
        current: input.current,
        candidates: byEmployee.get(input.employeeId) ?? [],
      }),
    );
  }

  return result;
}

/**
 * YTD for a live preview: posted slips in the same calendar year whose period
 * ends before the preview period end, plus the preview totals.
 */
export async function getPreviewPayslipYtd(input: {
  employeeId: string;
  periodKey: string;
  current: PayslipYtdContribution;
}): Promise<PayslipYtdTotals> {
  const map = await getPreviewPayslipYtdBatch([input]);
  return (
    map.get(input.employeeId) ??
    assemblePayslipYtd({
      year: yearFromPeriodKey(input.periodKey) ?? new Date().getFullYear(),
      priorPosted: [],
      current: input.current,
    })
  );
}

/**
 * Batch preview YTD for many employees in the same period key.
 * One query for all prior posted slips in that year.
 */
export async function getPreviewPayslipYtdBatch(
  inputs: Array<{
    employeeId: string;
    periodKey: string;
    current: PayslipYtdContribution;
  }>,
): Promise<Map<string, PayslipYtdTotals>> {
  const result = new Map<string, PayslipYtdTotals>();

  if (inputs.length === 0) {
    return result;
  }

  const periodKey = inputs[0].periodKey;
  const year = yearFromPeriodKey(periodKey);

  if (year == null) {
    const fallbackYear = new Date().getFullYear();
    for (const input of inputs) {
      result.set(
        input.employeeId,
        assemblePayslipYtd({
          year: fallbackYear,
          priorPosted: [],
          current: input.current,
        }),
      );
    }
    return result;
  }

  const [periodYear, periodMonth] = periodKey.split("-").map(Number);
  const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 0, 12));
  const employeeIds = [...new Set(inputs.map((row) => row.employeeId))];

  const priorRows = await prisma.payslip.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: "POSTED",
      payrollPeriod: {
        year,
        periodEnd: { lt: periodEnd },
      },
    },
    select: {
      employeeId: true,
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      monthlyTaxableEarnings: true,
      payeAmount: true,
      nisEmployeeAmount: true,
      healthSurchargeAmount: true,
    },
  });

  const priorByEmployee = new Map<string, PayslipYtdContribution[]>();
  for (const row of priorRows) {
    const list = priorByEmployee.get(row.employeeId) ?? [];
    list.push(toContribution(row));
    priorByEmployee.set(row.employeeId, list);
  }

  for (const input of inputs) {
    result.set(
      input.employeeId,
      assemblePayslipYtd({
        year,
        priorPosted: priorByEmployee.get(input.employeeId) ?? [],
        current: input.current,
      }),
    );
  }

  return result;
}

/**
 * Current-employer statutory YTD before a period (excludes this period).
 * Used by cumulative PAYE (Phases 4–5).
 */
export async function getEmployeeStatutoryYtdBeforePeriod(input: {
  employeeId: string;
  taxYear: number;
  periodEnd: Date;
}): Promise<{
  taxableEarnings: number;
  paye: number;
  nisEmployee: number;
  healthSurcharge: number;
  periodCount: number;
}> {
  const rows = await prisma.payslip.findMany({
    where: {
      employeeId: input.employeeId,
      status: "POSTED",
      payrollPeriod: {
        year: input.taxYear,
        periodEnd: { lt: input.periodEnd },
      },
    },
    select: {
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      monthlyTaxableEarnings: true,
      payeAmount: true,
      nisEmployeeAmount: true,
      healthSurchargeAmount: true,
    },
  });

  const totals = assemblePayslipYtd({
    year: input.taxYear,
    priorPosted: rows.map(toContribution),
  });

  return {
    taxableEarnings: totals.taxableEarnings,
    paye: totals.paye,
    nisEmployee: totals.nisEmployee,
    healthSurcharge: totals.healthSurcharge,
    periodCount: totals.periodCount,
  };
}

/** Phase 9: prior / this-employer / combined labels for a single employee YTD. */
export async function getPayslipYtdBreakdown(
  employeeId: string,
  currentEmployer: PayslipYtdTotals,
): Promise<PayslipYtdBreakdown> {
  const prior = await getEmployeePriorEmploymentTotals(
    employeeId,
    currentEmployer.year,
    { verifiedOnly: true },
  );
  return assemblePayslipYtdBreakdown({
    year: currentEmployer.year,
    currentEmployer,
    prior,
  });
}

/**
 * Batch Phase 9 breakdowns. Keys are `employeeId` (preview) or caller-chosen
 * when mapping from payslip ids after the fact.
 */
export async function getPayslipYtdBreakdownBatch(
  items: Array<{
    key: string;
    employeeId: string;
    currentEmployer: PayslipYtdTotals;
  }>,
): Promise<Map<string, PayslipYtdBreakdown>> {
  const result = new Map<string, PayslipYtdBreakdown>();

  if (items.length === 0) {
    return result;
  }

  const byYear = new Map<number, typeof items>();
  for (const item of items) {
    const list = byYear.get(item.currentEmployer.year) ?? [];
    list.push(item);
    byYear.set(item.currentEmployer.year, list);
  }

  for (const [year, yearItems] of byYear) {
    const employeeIds = [...new Set(yearItems.map((row) => row.employeeId))];
    const rows = await prisma.employeePriorEmploymentYtd.findMany({
      where: {
        employeeId: { in: employeeIds },
        taxYear: year,
        status: "ACTIVE",
      },
      select: {
        employeeId: true,
        taxableIncomeYtd: true,
        payeDeductedYtd: true,
        nisEmployeeYtd: true,
        nisEmployerYtd: true,
        healthSurchargeYtd: true,
        otherApprovedDeductionsYtd: true,
        verified: true,
      },
    });

    const priorByEmployee = new Map<
      string,
      ReturnType<typeof aggregatePriorEmploymentYtd>
    >();
    for (const employeeId of employeeIds) {
      const employeeRows = rows.filter((row) => row.employeeId === employeeId);
      priorByEmployee.set(
        employeeId,
        aggregatePriorEmploymentYtd(
          employeeRows.map((row) => ({
            taxableIncomeYtd: Number(row.taxableIncomeYtd.toString()),
            payeDeductedYtd: Number(row.payeDeductedYtd.toString()),
            nisEmployeeYtd:
              row.nisEmployeeYtd != null
                ? Number(row.nisEmployeeYtd.toString())
                : 0,
            nisEmployerYtd:
              row.nisEmployerYtd != null
                ? Number(row.nisEmployerYtd.toString())
                : 0,
            healthSurchargeYtd:
              row.healthSurchargeYtd != null
                ? Number(row.healthSurchargeYtd.toString())
                : 0,
            otherApprovedDeductionsYtd:
              row.otherApprovedDeductionsYtd != null
                ? Number(row.otherApprovedDeductionsYtd.toString())
                : 0,
            verified: row.verified,
          })),
        ),
      );
    }

    for (const item of yearItems) {
      result.set(
        item.key,
        assemblePayslipYtdBreakdown({
          year,
          currentEmployer: item.currentEmployer,
          prior: priorByEmployee.get(item.employeeId) ?? null,
        }),
      );
    }
  }

  return result;
}
