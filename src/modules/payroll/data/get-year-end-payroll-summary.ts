import { prisma } from "@/lib/prisma";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";

export type YearEndEmployeeSummary = {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  currency: string;
  grossPay: number;
  paye: number;
  nisEmployee: number;
  healthSurcharge: number;
  totalDeductions: number;
  netPay: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function deduction(snapshot: ReturnType<typeof parsePayslipSnapshot>, label: string) {
  return (
    snapshot?.payslip.deductions
      .filter((line) => line.label === label)
      .reduce((sum, line) => sum + line.amount, 0) ?? 0
  );
}

export async function getYearEndPayrollSummary(year: number) {
  const slips = await prisma.payslip.findMany({
    where: {
      status: "POSTED",
      payrollPeriod: { year },
    },
    orderBy: [{ employeeName: "asc" }],
    select: {
      employeeId: true,
      employeeNumber: true,
      employeeName: true,
      currency: true,
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      snapshot: true,
    },
  });

  const byEmployee = new Map<string, YearEndEmployeeSummary>();

  for (const slip of slips) {
    const key = `${slip.employeeId}:${slip.currency}`;
    const current =
      byEmployee.get(key) ??
      ({
        employeeId: slip.employeeId,
        employeeNumber: slip.employeeNumber,
        employeeName: slip.employeeName,
        currency: slip.currency,
        grossPay: 0,
        paye: 0,
        nisEmployee: 0,
        healthSurcharge: 0,
        totalDeductions: 0,
        netPay: 0,
      } satisfies YearEndEmployeeSummary);
    const snapshot = parsePayslipSnapshot(slip.snapshot);

    current.grossPay += Number(slip.grossPay.toString());
    current.totalDeductions += Number(slip.totalDeductions.toString());
    current.netPay += Number(slip.netPay.toString());
    current.paye += deduction(snapshot, "PAYE (income tax)");
    current.nisEmployee += deduction(snapshot, "NIS (employee)");
    current.healthSurcharge += deduction(snapshot, "Health Surcharge");

    byEmployee.set(key, current);
  }

  return {
    year,
    rows: [...byEmployee.values()].map((row) => ({
      ...row,
      grossPay: roundMoney(row.grossPay),
      paye: roundMoney(row.paye),
      nisEmployee: roundMoney(row.nisEmployee),
      healthSurcharge: roundMoney(row.healthSurcharge),
      totalDeductions: roundMoney(row.totalDeductions),
      netPay: roundMoney(row.netPay),
    })),
  };
}
