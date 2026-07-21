import { prisma } from "@/lib/prisma";
import { getEmployeePriorEmploymentYtds } from "@/src/modules/payroll/data/get-employee-prior-employment";
import { getEmployeeTaxProfile } from "@/src/modules/payroll/data/get-employee-tax-profile";
import { listEmployeeStatutoryOverrides } from "@/src/modules/payroll/data/get-statutory-overrides";
import {
  resolveEmployeeTaxPayeInputs,
  type ResolvedEmployeeTaxPayeInputs,
} from "@/src/modules/payroll/lib/resolve-employee-tax-paye-inputs";
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
  /** Raw EmployeeTaxProfile row when present. */
  taxProfile: Awaited<ReturnType<typeof getEmployeeTaxProfile>>;
  /**
   * Dual-read display summary: prefers tax profile, falls back to payroll
   * setup TD1 so the tax-year page is not blank before a profile is saved.
   */
  taxProfileSummary: ResolvedEmployeeTaxPayeInputs;
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

  const [taxProfile, priorEmployment, payrollProfile, postedRows, statutoryOverrides] =
    await Promise.all([
      getEmployeeTaxProfile(employeeId, year),
      getEmployeePriorEmploymentYtds(employeeId, year),
      prisma.payrollProfile.findUnique({
        where: { employeeId },
        select: { td1OtherApprovedAnnual: true },
      }),
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

  const taxProfileSummary = resolveEmployeeTaxPayeInputs({
    taxYear: year,
    taxProfile: taxProfile
      ? {
          taxCalculationMethod: taxProfile.taxCalculationMethod,
          taxProfileStatus: taxProfile.taxProfileStatus,
          personalAllowance:
            taxProfile.personalAllowance != null
              ? Number(taxProfile.personalAllowance)
              : null,
          personalAllowanceSource: taxProfile.personalAllowanceSource,
          td1OtherApprovedAnnual:
            taxProfile.td1OtherApprovedAnnual != null
              ? Number(taxProfile.td1OtherApprovedAnnual)
              : null,
          cumulativeCalculationEnabled: taxProfile.cumulativeCalculationEnabled,
          previousEmploymentDeclared: taxProfile.previousEmploymentDeclared,
          previousEmploymentVerified: taxProfile.previousEmploymentVerified,
        }
      : null,
    payrollProfile: {
      td1OtherApprovedAnnual:
        payrollProfile?.td1OtherApprovedAnnual != null
          ? Number(payrollProfile.td1OtherApprovedAnnual.toString())
          : null,
    },
    priorEmployment: priorEmployment.totals,
  });

  return {
    employee: {
      id: employee.id,
      displayName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeNumber: employee.employeeNumber,
    },
    taxYear: year,
    taxProfile,
    taxProfileSummary,
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
