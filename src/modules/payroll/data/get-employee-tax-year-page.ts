import { prisma } from "@/lib/prisma";
import { getEmployeePriorEmploymentYtds } from "@/src/modules/payroll/data/get-employee-prior-employment";
import { getEmployeeTaxProfile } from "@/src/modules/payroll/data/get-employee-tax-profile";
import { listEmployeeStatutoryOverrides } from "@/src/modules/payroll/data/get-statutory-overrides";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type TaxYearPostedPayslipRow = {
  id: string;
  periodKey: string;
  periodName: string;
  periodEnd: string;
  runNumber: string;
  grossPay: number;
  paye: number;
  nisEmployee: number;
  healthSurcharge: number;
  netPay: number;
  currency: string;
};

export type EmployeeTaxYearPageData = {
  employee: {
    id: string;
    displayName: string;
    employeeNumber: string;
  };
  taxYear: number;
  taxProfile: Awaited<ReturnType<typeof getEmployeeTaxProfile>>;
  priorEmployment: Awaited<ReturnType<typeof getEmployeePriorEmploymentYtds>>;
  postedPayslips: TaxYearPostedPayslipRow[];
  statutoryOverrides: Awaited<
    ReturnType<typeof listEmployeeStatutoryOverrides>
  >;
};

export async function getEmployeeTaxYearPage(
  employeeId: string,
  taxYear?: number,
): Promise<EmployeeTaxYearPageData | null> {
  const year =
    taxYear ?? taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });

  if (!employee) {
    return null;
  }

  const [taxProfile, priorEmployment, postedRows, statutoryOverrides] =
    await Promise.all([
      getEmployeeTaxProfile(employeeId, year),
      getEmployeePriorEmploymentYtds(employeeId, year),
      prisma.payslip.findMany({
        where: {
          employeeId,
          status: "POSTED",
          payrollPeriod: { year },
        },
        orderBy: [
          { payrollPeriod: { periodEnd: "asc" } },
          { createdAt: "asc" },
        ],
        select: {
          id: true,
          currency: true,
          grossPay: true,
          payeAmount: true,
          nisEmployeeAmount: true,
          healthSurchargeAmount: true,
          netPay: true,
          payRun: { select: { runNumber: true } },
          payrollPeriod: {
            select: {
              periodKey: true,
              name: true,
              periodEnd: true,
            },
          },
        },
      }),
      listEmployeeStatutoryOverrides(employeeId, year),
    ]);

  return {
    employee: {
      id: employee.id,
      displayName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeNumber: employee.employeeNumber,
    },
    taxYear: year,
    taxProfile,
    priorEmployment,
    postedPayslips: postedRows.map((row) => ({
      id: row.id,
      periodKey: row.payrollPeriod.periodKey,
      periodName: row.payrollPeriod.name,
      periodEnd: row.payrollPeriod.periodEnd.toISOString().slice(0, 10),
      runNumber: row.payRun.runNumber,
      grossPay: Number(row.grossPay.toString()),
      paye: Number(row.payeAmount.toString()),
      nisEmployee: Number(row.nisEmployeeAmount.toString()),
      healthSurcharge: Number(row.healthSurchargeAmount.toString()),
      netPay: Number(row.netPay.toString()),
      currency: row.currency,
    })),
    statutoryOverrides,
  };
}
