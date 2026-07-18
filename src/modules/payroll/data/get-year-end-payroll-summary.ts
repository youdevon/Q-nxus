import { prisma } from "@/lib/prisma";
import { parsePayslipSnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";
import {
  addCents,
  fromCents,
  sumMoney,
  toCents,
} from "@/src/modules/payroll/lib/money";

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


function deduction(snapshot: ReturnType<typeof parsePayslipSnapshot>, label: string) {
  const amounts =
    snapshot?.payslip.deductions
      .filter((line) => line.label === label)
      .map((line) => line.amount) ?? [];
  return sumMoney(...amounts);
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

  type YearEndCentsAccumulator = Omit<
    YearEndEmployeeSummary,
    "grossPay" | "paye" | "nisEmployee" | "healthSurcharge" | "totalDeductions" | "netPay"
  > & {
    grossPayCents: number;
    payeCents: number;
    nisEmployeeCents: number;
    healthSurchargeCents: number;
    totalDeductionsCents: number;
    netPayCents: number;
  };

  const byEmployee = new Map<string, YearEndCentsAccumulator>();

  for (const slip of slips) {
    const key = `${slip.employeeId}:${slip.currency}`;
    const current =
      byEmployee.get(key) ??
      ({
        employeeId: slip.employeeId,
        employeeNumber: slip.employeeNumber,
        employeeName: slip.employeeName,
        currency: slip.currency,
        grossPayCents: 0,
        payeCents: 0,
        nisEmployeeCents: 0,
        healthSurchargeCents: 0,
        totalDeductionsCents: 0,
        netPayCents: 0,
      } satisfies YearEndCentsAccumulator);
    const snapshot = parsePayslipSnapshot(slip.snapshot);

    current.grossPayCents = addCents(
      current.grossPayCents,
      toCents(Number(slip.grossPay.toString())),
    );
    current.totalDeductionsCents = addCents(
      current.totalDeductionsCents,
      toCents(Number(slip.totalDeductions.toString())),
    );
    current.netPayCents = addCents(
      current.netPayCents,
      toCents(Number(slip.netPay.toString())),
    );
    current.payeCents = addCents(
      current.payeCents,
      toCents(deduction(snapshot, "PAYE (income tax)")),
    );
    current.nisEmployeeCents = addCents(
      current.nisEmployeeCents,
      toCents(deduction(snapshot, "NIS (employee)")),
    );
    current.healthSurchargeCents = addCents(
      current.healthSurchargeCents,
      toCents(deduction(snapshot, "Health Surcharge")),
    );

    byEmployee.set(key, current);
  }

  return {
    year,
    rows: [...byEmployee.values()].map((row) => ({
      employeeId: row.employeeId,
      employeeNumber: row.employeeNumber,
      employeeName: row.employeeName,
      currency: row.currency,
      grossPay: fromCents(row.grossPayCents),
      paye: fromCents(row.payeCents),
      nisEmployee: fromCents(row.nisEmployeeCents),
      healthSurcharge: fromCents(row.healthSurchargeCents),
      totalDeductions: fromCents(row.totalDeductionsCents),
      netPay: fromCents(row.netPayCents),
    })),
  };
}
