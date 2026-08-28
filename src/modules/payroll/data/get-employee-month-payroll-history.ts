import { prisma } from "@/lib/prisma";
import type { AnnualPayeProjectionResult } from "@/src/modules/payroll/lib/annual-paye-projection";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";

export type EmployeeMonthPayrollHistoryRow = {
  payslipId: string;
  payRunId: string;
  periodKey: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string | null;
  runNumber: string;
  runStatus: string;
  payslipStatus: string;
  basicSalary: number;
  overtime: number;
  taxableAllowances: number;
  nonTaxableAllowances: number;
  grossPay: number;
  taxablePay: number;
  paye: number;
  nisEmployee: number;
  nisEmployer: number;
  healthSurcharge: number;
  pension: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  currency: string;
};

export type EmployeeMonthPayrollHistory = {
  employeeId: string;
  taxYear: number;
  rows: EmployeeMonthPayrollHistoryRow[];
  yearTotals: {
    grossPay: number;
    taxablePay: number;
    paye: number;
    nisEmployee: number;
    nisEmployer: number;
    healthSurcharge: number;
    totalDeductions: number;
    netPay: number;
  };
};

function sumLines(
  lines: Array<{ label: string; amount: number; isTaxable?: boolean }>,
  predicate: (line: { label: string; amount: number; isTaxable?: boolean }) => boolean,
): number {
  return lines
    .filter(predicate)
    .reduce((sum, line) => sum + line.amount, 0);
}

export async function getEmployeeMonthPayrollHistory(
  employeeId: string,
  taxYear: number,
): Promise<EmployeeMonthPayrollHistory | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });

  if (!employee) {
    return null;
  }

  const payslips = await prisma.payslip.findMany({
    where: {
      employeeId,
      status: { in: ["POSTED", "DRAFT"] },
      payrollPeriod: { year: taxYear },
    },
    orderBy: [
      { payrollPeriod: { periodEnd: "asc" } },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      status: true,
      currency: true,
      grossPay: true,
      monthlyTaxableEarnings: true,
      payeAmount: true,
      nisEmployeeAmount: true,
      healthSurchargeAmount: true,
      totalDeductions: true,
      netPay: true,
      baseSalary: true,
      snapshot: true,
      payRun: {
        select: {
          id: true,
          runNumber: true,
          status: true,
        },
      },
      payrollPeriod: {
        select: {
          periodKey: true,
          name: true,
          periodStart: true,
          periodEnd: true,
        },
      },
    },
  });

  const rows: EmployeeMonthPayrollHistoryRow[] = payslips.map((slip) => {
    const parsed = parsePayslipSnapshot(slip.snapshot);
    const earnings = parsed?.payslip.earnings ?? [];
    const deductions = parsed?.payslip.deductions ?? [];
    const employerContributions = parsed?.payslip.employerContributions ?? [];

    const nisEmployer =
      sumLines(employerContributions, (line) => /nis/i.test(line.label)) ||
      Number(
        (
          parsed?.payslip as { nisEmployerAmount?: number } | undefined
        )?.nisEmployerAmount ?? 0,
      );

    const basicSalary =
      Number(slip.baseSalary.toString()) ||
      sumLines(
        earnings,
        (line) =>
          /base|basic|salary/i.test(line.label) && line.isTaxable !== false,
      );
    const overtime = sumLines(earnings, (line) => /overtime/i.test(line.label));
    const taxableAllowances = sumLines(
      earnings,
      (line) =>
        Boolean(line.isTaxable) &&
        !/base|basic|salary|overtime/i.test(line.label),
    );
    const nonTaxableAllowances = sumLines(
      earnings,
      (line) => line.isTaxable === false,
    );
    const pension = sumLines(deductions, (line) =>
      /pension|annuity/i.test(line.label),
    );
    const statutoryDeductionLabels =
      /paye|nis|health|surcharge|pension|annuity|bank/i;
    const otherDeductions = sumLines(
      deductions,
      (line) => !statutoryDeductionLabels.test(line.label),
    );

    return {
      payslipId: slip.id,
      payRunId: slip.payRun.id,
      periodKey: slip.payrollPeriod.periodKey,
      periodName: slip.payrollPeriod.name,
      periodStart: slip.payrollPeriod.periodStart.toISOString().slice(0, 10),
      periodEnd: slip.payrollPeriod.periodEnd.toISOString().slice(0, 10),
      paymentDate: slip.payrollPeriod.periodEnd.toISOString().slice(0, 10),
      runNumber: slip.payRun.runNumber,
      runStatus: slip.payRun.status,
      payslipStatus: slip.status,
      basicSalary,
      overtime,
      taxableAllowances,
      nonTaxableAllowances,
      grossPay: Number(slip.grossPay.toString()),
      taxablePay: Number(slip.monthlyTaxableEarnings.toString()),
      paye: Number(slip.payeAmount.toString()),
      nisEmployee: Number(slip.nisEmployeeAmount.toString()),
      nisEmployer,
      healthSurcharge: Number(slip.healthSurchargeAmount.toString()),
      pension,
      otherDeductions,
      totalDeductions: Number(slip.totalDeductions.toString()),
      netPay: Number(slip.netPay.toString()),
      currency: slip.currency,
    };
  });

  const yearTotals = rows.reduce(
    (acc, row) => ({
      grossPay: acc.grossPay + row.grossPay,
      taxablePay: acc.taxablePay + row.taxablePay,
      paye: acc.paye + row.paye,
      nisEmployee: acc.nisEmployee + row.nisEmployee,
      nisEmployer: acc.nisEmployer + row.nisEmployer,
      healthSurcharge: acc.healthSurcharge + row.healthSurcharge,
      totalDeductions: acc.totalDeductions + row.totalDeductions,
      netPay: acc.netPay + row.netPay,
    }),
    {
      grossPay: 0,
      taxablePay: 0,
      paye: 0,
      nisEmployee: 0,
      nisEmployer: 0,
      healthSurcharge: 0,
      totalDeductions: 0,
      netPay: 0,
    },
  );

  return {
    employeeId,
    taxYear,
    rows,
    yearTotals,
  };
}

export function projectionToPersistedFields(result: AnnualPayeProjectionResult) {
  return {
    previousEmployerTaxableIncome: result.previousEmployer.taxableEarnings,
    currentEmployerActualTaxableIncome:
      result.currentEmployerActual.taxableEarnings,
    projectedRemainingTaxableIncome: result.projectedRemaining.taxableEarnings,
    projectedAnnualTaxableIncome: result.projectedAnnual.taxableEarnings,
    projectedEmployeeNis: result.projectedAnnual.employeeNis,
    projectedQualifyingNis: result.qualifying.qualifyingNisAmount,
    projectedPension: result.projectedAnnual.pensionContribution,
    projectedOtherQualifyingContributions:
      result.qualifying.otherQualifyingContribution,
    personalAllowance: result.personalAllowance,
    allowableQualifyingDeduction: result.qualifying.allowableQualifyingDeduction,
    projectedChargeableIncome: result.projectedChargeableIncome,
    projectedAnnualTaxLiability: result.projectedAnnualTaxLiability,
    previousEmployerPaye: result.previousEmployerPaye,
    currentEmployerPaye: result.currentEmployerPaye,
    manualTaxAdjustment: result.manualTaxAdjustment,
    remainingTaxLiability: result.remainingTaxLiability,
    remainingPayrollPeriods: result.periods.remainingPeriods,
    recommendedPayePerPeriod: result.recommendedPayePerPeriod,
    payFrequency: result.periods.payFrequency,
    warnings: result.warnings,
    calculationSnapshot: result as unknown as object,
  };
}
