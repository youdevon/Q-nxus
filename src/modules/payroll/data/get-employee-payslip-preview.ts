import { getOrganizationProfile } from "@/src/modules/admin/data/get-organization-profile";
import { prisma } from "@/lib/prisma";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/public";
import { getCurrentHealthSurchargeConfig } from "@/src/modules/payroll/data/get-health-surcharge-config";
import { getEmployeePayrollSetup } from "@/src/modules/payroll/data/get-employee-payroll-setup";
import { getCurrentNisClasses } from "@/src/modules/payroll/data/get-nis-classes";
import { getCurrentPayeTaxConfig } from "@/src/modules/payroll/data/get-paye-tax-config";
import { toHealthConfigInput } from "@/src/modules/payroll/lib/health-surcharge";
import { toNisClassInputs } from "@/src/modules/payroll/lib/nis-contribution";
import { toPayeConfigInput } from "@/src/modules/payroll/lib/paye-contribution";
import {
  assemblePayslipPreview,
  type PayslipEarningInput,
  type PayslipPreview,
} from "@/src/modules/payroll/lib/payslip-preview";
import { roundToCents } from "@/src/modules/payroll/lib/money";
import type { PayslipStatutorySnapshot } from "@/src/modules/payroll/lib/payslip-snapshot";
import {
  calculateCalendarOverlapDays,
  prorateMoney,
  resolveContractPaySegments,
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
  statutory: PayslipStatutorySnapshot;
};

function allowanceFrequencyLabel(frequency: string): string {
  return frequency
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Build a monthly payslip preview for an employee using current statutory
 * configs and contract pay elements that cover the selected period.
 *
 * Mid-month amendments use the current contract from its start date and any
 * prior SUPERSEDED contract only for uncovered earlier days in the period.
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

  const asOf = options?.asOf ?? new Date();
  const periodStart =
    options?.periodStart ??
    new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1, 12));
  const periodEnd =
    options?.periodEnd ??
    new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 0, 12));

  const [nisClasses, payeConfig, healthConfig, organization, employeeExtras, contracts] =
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
          position: {
            select: { title: true },
          },
          assignments: {
            where: { isCurrent: true },
            take: 1,
            select: {
              position: { select: { title: true } },
            },
          },
          department: {
            select: { name: true },
          },
          leaveRequests: {
            where: {
              status: "APPROVED",
              leaveType: { isPaid: false },
              startDate: { lte: periodEnd },
              endDate: { gte: periodStart },
            },
            select: {
              startDate: true,
              endDate: true,
              leaveType: { select: { name: true } },
            },
          },
        },
      }),
      prisma.employmentContract.findMany({
        where: {
          employeeId,
          status: { in: ["ACTIVE", "SUPERSEDED"] },
          startDate: { lte: periodEnd },
        },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          isCurrent: true,
          status: true,
          startDate: true,
          endDate: true,
          terminationDate: true,
          baseSalary: true,
          jobTitle: true,
          currency: true,
          allowances: {
            select: {
              amount: true,
              frequency: true,
              isTaxable: true,
              category: { select: { name: true } },
            },
          },
        },
      }),
    ]);

  const coverage = resolveContractPaySegments({
    periodStart,
    periodEnd,
    employeeHireDate: employeeExtras?.hireDate,
    employeeTerminationDate: employeeExtras?.terminationDate,
    contracts: contracts.map((contract) => ({
      id: contract.id,
      isCurrent: contract.isCurrent,
      status: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate,
      terminationDate: contract.terminationDate,
      baseSalary: Number(contract.baseSalary.toString()),
      jobTitle: contract.jobTitle,
      currency: contract.currency,
      allowances: contract.allowances.map((allowance) => ({
        label: allowance.category.name,
        amount: Number(allowance.amount.toString()),
        frequency: allowanceFrequencyLabel(allowance.frequency),
        isTaxable: allowance.isTaxable,
      })),
    })),
  });

  const earnings: PayslipEarningInput[] = [];

  for (const segment of coverage.segments) {
    const salaryAmount = prorateMoney(segment.baseSalary, segment.factor);
    earnings.push({
      label: `Base salary — ${segment.jobTitle}`,
      amount: salaryAmount,
      frequency: "Monthly",
      isTaxable: true,
      source: "CONTRACT_SALARY",
      detail: segment.detail ?? undefined,
    });

    for (const allowance of segment.allowances) {
      earnings.push({
        label: allowance.label,
        amount: prorateMoney(allowance.amount, segment.factor),
        frequency: allowance.frequency,
        isTaxable: allowance.isTaxable,
        source: "CONTRACT_ALLOWANCE",
        detail: segment.detail ?? undefined,
      });
    }
  }

  const unpaidLeaveDailyRateBase =
    coverage.segments.find((segment) =>
      contracts.some(
        (contract) =>
          contract.id === segment.contractId &&
          contract.isCurrent &&
          contract.status === "ACTIVE",
      ),
    )?.baseSalary ??
    coverage.segments[coverage.segments.length - 1]?.baseSalary ??
    (setup.currentContract
      ? Number(setup.currentContract.baseSalary)
      : 0);

  const unpaidLeaveDeductions =
    employeeExtras?.leaveRequests.map((request) => {
      const days = calculateCalendarOverlapDays({
        periodStart,
        periodEnd,
        startDate: request.startDate,
        endDate: request.endDate,
      });
      const dailyRate =
        coverage.periodDays > 0
          ? unpaidLeaveDailyRateBase / coverage.periodDays
          : 0;
      return {
        label: `Unpaid leave — ${request.leaveType.name}`,
        amount: roundToCents(days * dailyRate),
        detail: `${days} calendar day${days === 1 ? "" : "s"} overlapping period`,
      };
    }) ?? [];

  const primarySegment =
    coverage.segments.find((segment) =>
      contracts.some(
        (contract) =>
          contract.id === segment.contractId &&
          contract.isCurrent &&
          contract.status === "ACTIVE",
      ),
    ) ?? coverage.segments[coverage.segments.length - 1];

  const readiness =
    coverage.segments.length === 0 && Boolean(setup.currentContract)
      ? {
          isReady: setup.readiness.isReady,
          blockingIssues: [
            ...setup.readiness.blockingIssues,
            coverage.detail ??
              "No contract covers this pay period — earnings are zero.",
          ],
        }
      : setup.readiness;

  const payslip = assemblePayslipPreview({
    employee: {
      id: setup.employee.id,
      employeeNumber: setup.employee.employeeNumber,
      displayName: setup.employee.displayName,
      dateOfBirth: setup.employee.dateOfBirth,
      nisNumber: setup.statutoryNumbers.nisNumber,
      birNumber: setup.statutoryNumbers.birNumber,
    },
    currency:
      primarySegment?.currency ??
      setup.currentContract?.currency ??
      setup.payElements[0]?.currency ??
      "TTD",
    payFrequency: setup.profile?.payFrequency ?? "MONTHLY",
    paymentMethod: setup.profile?.paymentMethod ?? "BANK_TRANSFER",
    asOf,
    periodStart,
    periodEnd,
    earnings: earnings.concat(
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
      percentage:
        account.percentage != null ? Number(account.percentage) : null,
      isPrimary: account.isPrimary,
      allocationKind: account.isPrimary
        ? ("REMAINDER" as const)
        : account.percentage != null && Number(account.percentage) > 0
          ? ("PERCENTAGE" as const)
          : ("FIXED" as const),
      priority: account.sortOrder,
    })),
    postNetSplitEnabled: setup.bankingFlags.postNetSplitEnabled,
    readiness,
    td1OtherApprovedAnnual:
      setup.profile?.td1OtherApprovedAnnual != null
        ? Number(setup.profile.td1OtherApprovedAnnual)
        : 0,
    pensionOnlyIncome: setup.profile?.pensionOnlyIncome ?? false,
    exemptFromNis: setup.profile?.exemptFromNis ?? false,
    exemptFromHealthSurcharge:
      setup.profile?.exemptFromHealthSurcharge ?? false,
    exemptFromPaye: setup.profile?.exemptFromPaye ?? false,
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
      jobTitle: resolveEmployeePositionTitle({
        assignmentPositionTitle:
          employeeExtras?.assignments[0]?.position?.title,
        positionTitle: employeeExtras?.position?.title,
        contractJobTitle:
          primarySegment?.jobTitle ??
          setup.currentContract?.positionTitle ??
          null,
      }),
      departmentName: employeeExtras?.department?.name ?? null,
    },
    statutory: {
      payeConfigId: payeConfig?.id ?? null,
      payeVersionLabel: payeConfig?.versionLabel ?? null,
      payeEffectiveFrom: payeConfig?.effectiveFrom ?? null,
      healthConfigId: healthConfig?.id ?? null,
      healthVersionLabel: healthConfig?.versionLabel ?? null,
      healthEffectiveFrom: healthConfig?.effectiveFrom ?? null,
      nisVersionLabel: nisClasses[0]?.versionLabel ?? null,
      nisEffectiveFrom: nisClasses[0]?.effectiveFrom ?? null,
      nisClassCount: nisClasses.length,
    },
  };
}
