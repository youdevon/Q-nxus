import { getOrganizationProfile } from "@/src/modules/admin/data/get-organization-profile";
import { prisma } from "@/lib/prisma";
import { getCurrentHealthSurchargeConfig } from "@/src/modules/payroll/data/get-health-surcharge-config";
import { getEmployeePayrollSetup } from "@/src/modules/payroll/data/get-employee-payroll-setup";
import { getCurrentNisClasses } from "@/src/modules/payroll/data/get-nis-classes";
import { getCurrentPayeTaxConfig } from "@/src/modules/payroll/data/get-paye-tax-config";
import { toHealthConfigInput } from "@/src/modules/payroll/lib/health-surcharge";
import { toNisClassInputs } from "@/src/modules/payroll/lib/nis-contribution";
import { toPayeConfigInput } from "@/src/modules/payroll/lib/paye-contribution";
import {
  assemblePayslipPreview,
  type PayslipPreview,
} from "@/src/modules/payroll/lib/payslip-preview";
import {
  calculateCalendarOverlapDays,
  calculateCalendarProration,
  prorateMoney,
} from "@/src/modules/payroll/lib/payroll-period-adjustments";

export type { PayslipPreview };

/** Presentation metadata for the payslip document (not used in calculations). */
export type PayslipDocumentMeta = {
  organizationName: string;
  jobTitle: string | null;
  departmentName: string | null;
};

export type EmployeePayslipPreviewResult = {
  payslip: PayslipPreview;
  meta: PayslipDocumentMeta;
};

/**
 * Build a monthly payslip preview for an employee using current statutory
 * configs and the current contract pay elements.
 */
export async function getEmployeePayslipPreview(
  employeeId: string,
  options?: {
    asOf?: Date;
    periodStart?: Date;
    periodEnd?: Date;
    variableEarnings?: Array<{
      label: string;
      amount: number;
      isTaxable: boolean;
      detail?: string;
    }>;
    variableDeductions?: Array<{
      label: string;
      amount: number;
      detail?: string;
    }>;
  },
): Promise<EmployeePayslipPreviewResult | null> {
  const setup = await getEmployeePayrollSetup(employeeId);

  if (!setup) {
    return null;
  }

  const [nisClasses, payeConfig, healthConfig, organization, employeeExtras] =
    await Promise.all([
      getCurrentNisClasses(),
      getCurrentPayeTaxConfig(),
      getCurrentHealthSurchargeConfig(),
      getOrganizationProfile(),
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          hireDate: true,
          terminationDate: true,
          department: {
            select: { name: true },
          },
          leaveRequests: {
            where: {
              status: "APPROVED",
              leaveType: { isPaid: false },
              startDate: { lte: options?.periodEnd ?? options?.asOf },
              endDate: { gte: options?.periodStart ?? options?.asOf },
            },
            select: {
              startDate: true,
              endDate: true,
              leaveType: { select: { name: true } },
            },
          },
        },
      }),
    ]);

  const asOf = options?.asOf ?? new Date();
  const periodStart =
    options?.periodStart ??
    new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1, 12));
  const periodEnd =
    options?.periodEnd ??
    new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 0, 12));
  const proration = calculateCalendarProration({
    periodStart,
    periodEnd,
    employeeHireDate: employeeExtras?.hireDate,
    employeeTerminationDate: employeeExtras?.terminationDate,
    contractStartDate: setup.currentContract?.startDate,
    contractEndDate: setup.currentContract?.endDate,
    contractTerminationDate: setup.currentContract?.terminationDate,
  });

  const monthlyBaseSalary = setup.payElements
    .filter((element) => element.source === "CONTRACT_SALARY")
    .reduce((sum, element) => sum + Number(element.amount), 0);
  const unpaidLeaveDeductions =
    employeeExtras?.leaveRequests.map((request) => {
      const days = calculateCalendarOverlapDays({
        periodStart,
        periodEnd,
        startDate: request.startDate,
        endDate: request.endDate,
      });
      const dailyRate =
        proration.periodDays > 0 ? monthlyBaseSalary / proration.periodDays : 0;
      return {
        label: `Unpaid leave — ${request.leaveType.name}`,
        amount: Math.round(days * dailyRate * 100) / 100,
        detail: `${days} calendar day${days === 1 ? "" : "s"} overlapping period`,
      };
    }) ?? [];

  const payslip = assemblePayslipPreview({
    employee: {
      id: setup.employee.id,
      employeeNumber: setup.employee.employeeNumber,
      displayName: setup.employee.displayName,
      dateOfBirth: setup.employee.dateOfBirth,
      nisNumber: setup.profile?.nisNumber ?? null,
      birNumber: setup.profile?.birNumber ?? null,
    },
    currency:
      setup.currentContract?.currency ??
      setup.payElements[0]?.currency ??
      "TTD",
    payFrequency: setup.profile?.payFrequency ?? "MONTHLY",
    paymentMethod: setup.profile?.paymentMethod ?? "BANK_TRANSFER",
    asOf,
    periodStart,
    periodEnd,
    earnings: setup.payElements.map((element) => ({
      label: element.label,
      amount:
        element.source === "CONTRACT_SALARY" ||
        element.source === "CONTRACT_ALLOWANCE"
          ? prorateMoney(Number(element.amount), proration.factor)
          : Number(element.amount),
      frequency: element.frequency,
      isTaxable: element.isTaxable,
      source: element.source,
      detail: proration.detail ?? undefined,
    })).concat(
      (options?.variableEarnings ?? []).map((line) => ({
        label: line.label,
        amount: line.amount,
        frequency: "Monthly",
        isTaxable: line.isTaxable,
        source: "VARIABLE_EARNING" as const,
        detail: line.detail,
      })),
    ),
    deductions: [
      ...unpaidLeaveDeductions,
      ...(options?.variableDeductions ?? []),
    ],
    bankAccounts: setup.bankAccounts.map((account) => ({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      amount: account.amount != null ? Number(account.amount) : null,
      isPrimary: account.isPrimary,
    })),
    readiness: setup.readiness,
    td1OtherApprovedAnnual:
      setup.profile?.td1OtherApprovedAnnual != null
        ? Number(setup.profile.td1OtherApprovedAnnual)
        : 0,
    pensionOnlyIncome: setup.profile?.pensionOnlyIncome ?? false,
    nisClasses: toNisClassInputs(nisClasses),
    payeConfig: payeConfig != null ? toPayeConfigInput(payeConfig) : null,
    healthConfig:
      healthConfig != null ? toHealthConfigInput(healthConfig) : null,
  });

  return {
    payslip,
    meta: {
      organizationName:
        organization?.legalName?.trim() ||
        organization?.name?.trim() ||
        "Organization",
      jobTitle: setup.currentContract?.jobTitle ?? null,
      departmentName: employeeExtras?.department?.name ?? null,
    },
  };
}
