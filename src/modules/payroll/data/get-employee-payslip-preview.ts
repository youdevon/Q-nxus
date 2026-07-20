import { getOrganizationProfile } from "@/src/modules/admin/data/get-organization-profile";
import { prisma } from "@/lib/prisma";
import { resolveEmployeePositionTitle } from "@/src/modules/hr/public";
import { getEmployeePayrollSetup } from "@/src/modules/payroll/data/get-employee-payroll-setup";
import { getEmployeeStatutoryYtdBeforePeriod } from "@/src/modules/payroll/data/get-payslip-ytd";
import {
  resolveStatutoryConfigBundle,
  toPayslipStatutorySnapshot,
} from "@/src/modules/payroll/data/get-statutory-bundle";
import { toHealthConfigInput } from "@/src/modules/payroll/lib/health-surcharge";
import { toNisClassInputs } from "@/src/modules/payroll/lib/nis-contribution";
import { toPayeConfigInput } from "@/src/modules/payroll/lib/paye-contribution";
import {
  applyPersonalAllowanceOverride,
  resolveEmployeeTaxPayeInputs,
} from "@/src/modules/payroll/lib/resolve-employee-tax-paye-inputs";
import {
  monthsElapsedFromPeriodEnd,
  shouldUseCumulativePaye,
} from "@/src/modules/payroll/lib/cumulative-paye";
import { evaluatePayeExceptions } from "@/src/modules/payroll/lib/paye-exceptions";
import { getApprovedStatutoryOverrideForPeriod } from "@/src/modules/payroll/data/get-statutory-overrides";
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
import { applyRecurringItemsForPeriod } from "@/src/modules/payroll/lib/recurring-payroll-items";
import { loadEmployeeRecurringItems } from "@/src/modules/payroll/services/recurring-payroll-balances";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

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
 * Build a monthly payslip preview for an employee using statutory configs
 * effective as of the pay period end (not wall-clock "today").
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
    /** Shared period bundle for batch previews (avoids N statutory lookups). */
    statutoryBundle?: Awaited<ReturnType<typeof resolveStatutoryConfigBundle>>;
    /** Shared org display name for batch previews. */
    organizationName?: string | null;
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
  const setup = await getEmployeePayrollSetup(employeeId, {
    includeStatutoryPreview: false,
    includeFinancialInstitutions: false,
    includePriorDocuments: false,
  });

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

  // Statutory schedules follow the period being paid, not the date of recalculation.
  const statutoryAsOf = toStatutoryAsOfKey(periodEnd);
  const taxYear = taxYearFromAsOfKey(statutoryAsOf);

  const [
    statutoryBundle,
    organization,
    employeeExtras,
    contracts,
    recurringItems,
    currentEmployerYtdBefore,
    statutoryOverride,
  ] = await Promise.all([
      options?.statutoryBundle
        ? Promise.resolve(options.statutoryBundle)
        : resolveStatutoryConfigBundle(statutoryAsOf),
      options?.organizationName != null
        ? Promise.resolve(null)
        : getOrganizationProfile(),
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
      loadEmployeeRecurringItems(prisma, employeeId),
      getEmployeeStatutoryYtdBeforePeriod({
        employeeId,
        taxYear,
        periodEnd,
      }),
      getApprovedStatutoryOverrideForPeriod({
        employeeId,
        periodEnd,
      }),
    ]);

  const nisClasses = statutoryBundle.nisClasses;
  const payeConfigRecord = statutoryBundle.paye;
  const healthConfig = statutoryBundle.health;

  const resolvedTax = resolveEmployeeTaxPayeInputs({
    taxYear,
    taxProfile: setup.taxProfile.id
      ? {
          taxCalculationMethod: setup.taxProfile.taxCalculationMethod,
          taxProfileStatus: setup.taxProfile.taxProfileStatus ?? "ACTIVE",
          personalAllowance:
            setup.taxProfile.personalAllowance != null
              ? Number(setup.taxProfile.personalAllowance)
              : null,
          personalAllowanceSource: setup.taxProfile.personalAllowanceSource,
          td1OtherApprovedAnnual:
            setup.taxProfile.td1OtherApprovedAnnual != null
              ? Number(setup.taxProfile.td1OtherApprovedAnnual)
              : null,
          cumulativeCalculationEnabled:
            setup.taxProfile.cumulativeCalculationEnabled,
          previousEmploymentDeclared:
            setup.taxProfile.previousEmploymentDeclared,
          previousEmploymentVerified:
            setup.taxProfile.previousEmploymentVerified,
        }
      : null,
    payrollProfile: {
      td1OtherApprovedAnnual:
        setup.profile?.td1OtherApprovedAnnual != null
          ? Number(setup.profile.td1OtherApprovedAnnual)
          : null,
    },
    priorEmployment: {
      taxableIncomeYtd: setup.priorEmployment.totals.taxableIncomeYtd,
      payeDeductedYtd: setup.priorEmployment.totals.payeDeductedYtd,
      nisEmployeeYtd: setup.priorEmployment.totals.nisEmployeeYtd,
      nisEmployerYtd: 0,
      healthSurchargeYtd: setup.priorEmployment.totals.healthSurchargeYtd,
      otherApprovedDeductionsYtd:
        setup.priorEmployment.totals.otherApprovedDeductionsYtd,
      recordCount: setup.priorEmployment.totals.recordCount,
      verifiedCount: setup.priorEmployment.totals.verifiedCount,
      allVerified: setup.priorEmployment.totals.allVerified,
    },
  });

  const payeConfig =
    payeConfigRecord != null
      ? applyPersonalAllowanceOverride(
          toPayeConfigInput(payeConfigRecord),
          resolvedTax.personalAllowanceOverride,
        )
      : null;

  const recurringLines = applyRecurringItemsForPeriod(
    recurringItems,
    periodStart,
    periodEnd,
  );
  const recurringEarnings = recurringLines
    .filter((line) => line.kind === "EARNING")
    .map((line) => ({
      label: line.label,
      amount: line.amount,
      isTaxable: line.isTaxable,
      detail: line.detail,
    }));
  const recurringDeductions = recurringLines
    .filter((line) => line.kind === "DEDUCTION")
    .map((line) => ({
      label: line.label,
      amount: line.amount,
      detail: line.detail,
    }));

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
      recurringEarnings.map((line) => ({
        label: line.label,
        amount: line.amount,
        frequency: "Monthly",
        isTaxable: line.isTaxable,
        source: "VARIABLE_EARNING" as const,
        detail: line.detail,
      })),
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
      ...recurringDeductions,
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
    td1OtherApprovedAnnual: resolvedTax.td1OtherApprovedAnnual,
    pensionOnlyIncome: setup.profile?.pensionOnlyIncome ?? false,
    exemptFromNis: setup.profile?.exemptFromNis ?? false,
    exemptFromHealthSurcharge:
      setup.profile?.exemptFromHealthSurcharge ?? false,
    exemptFromPaye: setup.profile?.exemptFromPaye ?? false,
    nisClasses: toNisClassInputs(nisClasses),
    payeConfig,
    healthConfig:
      healthConfig != null ? toHealthConfigInput(healthConfig) : null,
    cumulativePaye: {
      enabled: shouldUseCumulativePaye({
        taxCalculationMethod: resolvedTax.taxCalculationMethod,
        cumulativeCalculationEnabled: resolvedTax.cumulativeCalculationEnabled,
      }),
      currentEmployerTaxableYtd: currentEmployerYtdBefore.taxableEarnings,
      currentEmployerPayePaidYtd: currentEmployerYtdBefore.paye,
      currentEmployerNisPaidYtd: currentEmployerYtdBefore.nisEmployee,
      priorTaxableYtd: resolvedTax.priorEmployment.taxableIncomeYtd,
      priorPayePaidYtd: resolvedTax.priorEmployment.payeDeductedYtd,
      priorNisEmployeeYtd: resolvedTax.priorEmployment.nisEmployeeYtd,
      priorOtherApprovedYtd:
        resolvedTax.priorEmployment.otherApprovedDeductionsYtd,
      monthsElapsed: monthsElapsedFromPeriodEnd(periodEnd),
    },
    statutoryOverrides: statutoryOverride
      ? {
          payeAmount: statutoryOverride.payeAmount,
          nisEmployeeAmount: statutoryOverride.nisEmployeeAmount,
          healthSurchargeAmount: statutoryOverride.healthSurchargeAmount,
          reason: statutoryOverride.reason,
        }
      : undefined,
    taxCalcNotes: [
      ...resolvedTax.calcNotes,
      ...evaluatePayeExceptions({
        previousEmploymentDeclared: resolvedTax.previousEmploymentDeclared,
        priorEmploymentRecordCount: resolvedTax.priorEmployment.recordCount,
        priorEmploymentAllVerified: resolvedTax.priorEmployment.allVerified,
        cumulativeEnabled: shouldUseCumulativePaye({
          taxCalculationMethod: resolvedTax.taxCalculationMethod,
          cumulativeCalculationEnabled:
            resolvedTax.cumulativeCalculationEnabled,
        }),
      }),
    ],
  });

  return {
    payslip,
    meta: {
      organizationName:
        options?.organizationName?.trim() ||
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
      ...toPayslipStatutorySnapshot(statutoryBundle),
      priorEmployment:
        resolvedTax.priorEmployment.recordCount > 0
          ? {
              taxableIncomeYtd: resolvedTax.priorEmployment.taxableIncomeYtd,
              payeDeductedYtd: resolvedTax.priorEmployment.payeDeductedYtd,
              recordCount: resolvedTax.priorEmployment.recordCount,
              allVerified: resolvedTax.priorEmployment.allVerified,
            }
          : null,
    },
  };
}
