import { prisma } from "@/lib/prisma";
import { listSavedAnnualProjections } from "@/src/modules/payroll/data/get-annual-paye-projections";
import { listEarningTreatmentOverrides } from "@/src/modules/payroll/data/get-earning-treatment-overrides";
import { getEmployeePriorEmploymentYtds } from "@/src/modules/payroll/data/get-employee-prior-employment";
import { getEmployeeTaxProfile } from "@/src/modules/payroll/data/get-employee-tax-profile";
import { getPayeTaxConfigAsOf } from "@/src/modules/payroll/data/get-paye-tax-config";
import { listEmployeeStatutoryOverrides } from "@/src/modules/payroll/data/get-statutory-overrides";
import {
  computeAnnualPayeProjection,
  type AnnualPayeProjectionResult,
} from "@/src/modules/payroll/lib/annual-paye-projection";
import { isTaxableFromTreatment } from "@/src/modules/payroll/lib/earning-treatment";
import { toPayeConfigInput } from "@/src/modules/payroll/lib/paye-contribution";
import {
  applyRecurringItemsForPeriod,
} from "@/src/modules/payroll/lib/recurring-payroll-items";
import type { PayFrequencyCode } from "@/src/modules/payroll/lib/remaining-payroll-periods";
import {
  applyPersonalAllowanceOverride,
  resolveEmployeeTaxPayeInputs,
  type ResolvedEmployeeTaxPayeInputs,
} from "@/src/modules/payroll/lib/resolve-employee-tax-paye-inputs";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";
import { loadEmployeeRecurringItems } from "@/src/modules/payroll/services/recurring-payroll-balances";

export type TaxYearPostedPayslipRow = {
  id: string;
  periodKey: string;
  periodName: string;
  periodEnd: string;
  runNumber: string;
  payRunId: string;
  grossPay: number;
  taxableEarnings: number;
  paye: number;
  nisEmployee: number;
  healthSurcharge: number;
  netPay: number;
  currency: string;
};

export type TaxYearAdjustmentListRow = {
  id: string;
  adjustmentType: string;
  adjustmentValue: number;
  reason: string;
  status: string;
  effectiveFrom: string;
  enteredByUserId: string;
  approvedByUserId: string | null;
  rejectedReason: string | null;
  updatedAt: string;
};

export type EmployeeTaxYearPageData = {
  employee: {
    id: string;
    displayName: string;
    employeeNumber: string;
    departmentName: string | null;
    positionTitle: string | null;
    hireDate: string | null;
  };
  taxYear: number;
  taxProfile: Awaited<ReturnType<typeof getEmployeeTaxProfile>>;
  taxProfileSummary: ResolvedEmployeeTaxPayeInputs;
  priorEmployment: Awaited<ReturnType<typeof getEmployeePriorEmploymentYtds>>;
  postedPayslips: TaxYearPostedPayslipRow[];
  statutoryOverrides: Awaited<
    ReturnType<typeof listEmployeeStatutoryOverrides>
  >;
  /** Live annual PAYE projection (includes approved adjustments). */
  annualProjection: AnnualPayeProjectionResult | null;
  savedProjections: Awaited<ReturnType<typeof listSavedAnnualProjections>>;
  taxYearAdjustments: TaxYearAdjustmentListRow[];
  earningTreatmentOverrides: Awaited<
    ReturnType<typeof listEarningTreatmentOverrides>
  >;
  componentOptions: Array<{ id: string; code: string; name: string }>;
  projectionContext: {
    payFrequency: PayFrequencyCode;
    monthlyBasicSalary: number | null;
    contractEndDate: string | null;
    currency: string;
    payeConfigVersionLabel: string | null;
  };
};

function sumApprovedAdjustments(
  rows: Array<{
    adjustmentType: string;
    adjustmentValue: { toString(): string };
    status: string;
  }>,
  type: string,
): number {
  return rows
    .filter((row) => row.status === "APPROVED" && row.adjustmentType === type)
    .reduce((sum, row) => sum + Number(row.adjustmentValue.toString()), 0);
}

/** Latest approved absolute override (rows expected newest-first). */
function latestApprovedAbsolute(
  rows: Array<{
    adjustmentType: string;
    adjustmentValue: { toString(): string };
    status: string;
  }>,
  type: string,
): number | null {
  const row = rows.find(
    (entry) => entry.status === "APPROVED" && entry.adjustmentType === type,
  );
  if (!row) {
    return null;
  }
  const value = Number(row.adjustmentValue.toString());
  return Number.isFinite(value) ? value : null;
}

export async function getEmployeeTaxYearPage(
  employeeId: string,
  taxYear?: number,
): Promise<EmployeeTaxYearPageData | null> {
  const year =
    taxYear ?? taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));
  const asOfKey = `${year}-12-31`;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      hireDate: true,
      terminationDate: true,
      department: { select: { name: true } },
      position: { select: { title: true } },
      payrollProfile: {
        select: { payFrequency: true },
      },
      contracts: {
        where: { isCurrent: true },
        take: 1,
        select: {
          baseSalary: true,
          currency: true,
          endDate: true,
          jobTitle: true,
          allowances: {
            select: {
              amount: true,
              frequency: true,
              isTaxable: true,
            },
          },
        },
      },
    },
  });

  if (!employee) {
    return null;
  }

  const [
    taxProfile,
    priorEmployment,
    postedRows,
    statutoryOverrides,
    payeConfig,
    savedProjections,
    adjustmentRows,
    earningTreatmentOverrides,
    componentDefs,
    recurringItems,
  ] = await Promise.all([
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
        monthlyTaxableEarnings: true,
        payeAmount: true,
        nisEmployeeAmount: true,
        healthSurchargeAmount: true,
        netPay: true,
        payRun: { select: { id: true, runNumber: true } },
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
    getPayeTaxConfigAsOf(asOfKey),
    listSavedAnnualProjections(employeeId, year),
    prisma.employeeTaxYearAdjustment.findMany({
      where: { employeeId, taxYear: year },
      orderBy: [{ createdAt: "desc" }],
    }),
    listEarningTreatmentOverrides(employeeId),
    prisma.payrollComponentDefinition.findMany({
      where: {
        organizationId: employee.organizationId,
        isActive: true,
        kind: "EARNING",
      },
      orderBy: [{ code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    loadEmployeeRecurringItems(prisma, employeeId),
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
    priorEmployment: priorEmployment.totals,
  });

  const postedPayslips: TaxYearPostedPayslipRow[] = postedRows.map((row) => ({
    id: row.id,
    periodKey: row.payrollPeriod.periodKey,
    periodName: row.payrollPeriod.name,
    periodEnd: row.payrollPeriod.periodEnd.toISOString().slice(0, 10),
    runNumber: row.payRun.runNumber,
    payRunId: row.payRun.id,
    grossPay: Number(row.grossPay.toString()),
    taxableEarnings: Number(row.monthlyTaxableEarnings.toString()),
    paye: Number(row.payeAmount.toString()),
    nisEmployee: Number(row.nisEmployeeAmount.toString()),
    healthSurcharge: Number(row.healthSurchargeAmount.toString()),
    netPay: Number(row.netPay.toString()),
    currency: row.currency,
  }));

  const currentEmployerActual = {
    taxableEarnings:
      postedPayslips.reduce((sum, row) => sum + row.taxableEarnings, 0) +
      sumApprovedAdjustments(adjustmentRows, "TAXABLE_EARNINGS"),
    paye: postedPayslips.reduce((sum, row) => sum + row.paye, 0),
    employeeNis:
      postedPayslips.reduce((sum, row) => sum + row.nisEmployee, 0) +
      sumApprovedAdjustments(adjustmentRows, "NIS"),
    pensionContribution: sumApprovedAdjustments(adjustmentRows, "PENSION"),
    otherQualifyingContribution: sumApprovedAdjustments(
      adjustmentRows,
      "QUALIFYING_DEDUCTION",
    ),
  };

  const nonTaxableEarningsAdj = sumApprovedAdjustments(
    adjustmentRows,
    "NON_TAXABLE_EARNINGS",
  );
  const healthSurchargeAdj = sumApprovedAdjustments(
    adjustmentRows,
    "HEALTH_SURCHARGE",
  );

  const lastPostedEnd = postedPayslips.at(-1)?.periodEnd ?? null;
  const asOfDate = lastPostedEnd
    ? new Date(`${lastPostedEnd}T00:00:00.000Z`)
    : new Date();

  const payFrequency = (employee.payrollProfile?.payFrequency ??
    "MONTHLY") as PayFrequencyCode;
  const currentContract = employee.contracts[0] ?? null;
  const monthlyBasicSalary =
    currentContract != null
      ? Number(currentContract.baseSalary.toString())
      : null;
  const monthlyTaxableAllowances =
    currentContract?.allowances
      .filter((row) => row.isTaxable && row.frequency === "MONTHLY")
      .reduce((sum, row) => sum + Number(row.amount.toString()), 0) ?? 0;
  const contractEndDate = currentContract?.endDate
    ? currentContract.endDate.toISOString().slice(0, 10)
    : null;
  const employmentEndDate =
    employee.terminationDate ?? currentContract?.endDate ?? null;

  const currency =
    postedPayslips[0]?.currency ?? currentContract?.currency ?? "TTD";

  const treatmentMap = new Map(
    earningTreatmentOverrides
      .filter((row) => row.status === "APPROVED")
      .map((row) => [
        row.componentDefinitionId,
        {
          isTaxable: isTaxableFromTreatment(
            row.taxTreatment as
              | "TAXABLE_EMPLOYMENT"
              | "NON_TAXABLE"
              | "NIS_ONLY"
              | "PAYE_EXEMPT",
          ),
          includeInProjectedEarnings: row.includeInProjectedEarnings,
        },
      ]),
  );

  const projectionAsOf = new Date(`${year}-12-31T00:00:00.000Z`);
  const recurringForProjection = applyRecurringItemsForPeriod(
    recurringItems,
    new Date(`${year}-01-01T00:00:00.000Z`),
    projectionAsOf,
    treatmentMap,
  );
  const recurringTaxablePerPeriod = recurringForProjection
    .filter((line) => line.kind === "EARNING")
    .filter((line) => {
      const defId = recurringItems.find(
        (item) => item.definition.code === line.code,
      )?.definition.id;
      const treatment = defId ? treatmentMap.get(defId) : undefined;
      if (treatment && treatment.includeInProjectedEarnings === false) {
        return false;
      }
      return line.isTaxable;
    })
    .reduce((sum, line) => sum + line.amount, 0);

  const projectedEarningsAdj = sumApprovedAdjustments(
    adjustmentRows,
    "PROJECTED_EARNINGS",
  );
  const projectedTaxablePerRemainingPeriod =
    (monthlyBasicSalary ?? 0) +
    monthlyTaxableAllowances +
    recurringTaxablePerPeriod +
    projectedEarningsAdj;

  const personalAllowanceAdj = sumApprovedAdjustments(
    adjustmentRows,
    "PERSONAL_ALLOWANCE",
  );
  const personalAllowanceOverride =
    taxProfileSummary.personalAllowanceOverride != null ||
    personalAllowanceAdj !== 0
      ? (taxProfileSummary.personalAllowanceOverride ?? 0) + personalAllowanceAdj
      : null;

  const manualTaxAdjustment =
    sumApprovedAdjustments(adjustmentRows, "PAYE") +
    sumApprovedAdjustments(adjustmentRows, "OTHER_TAX") +
    sumApprovedAdjustments(adjustmentRows, "TAX_RATE_INSTRUCTION");

  const remainingPeriodsOverride = latestApprovedAbsolute(
    adjustmentRows,
    "REMAINING_PERIOD",
  );
  const nisPortionOverride = latestApprovedAbsolute(
    adjustmentRows,
    "NIS_DEDUCTIBLE_PORTION",
  );
  const deductionCapOverride = latestApprovedAbsolute(
    adjustmentRows,
    "APPROVED_DEDUCTION_CAP",
  );

  let annualProjection: AnnualPayeProjectionResult | null = null;

  if (payeConfig) {
    const config = applyPersonalAllowanceOverride(
      toPayeConfigInput(payeConfig),
      personalAllowanceOverride,
    );

    const verified = priorEmployment.verifiedTotals;
    annualProjection = computeAnnualPayeProjection({
      taxYear: year,
      asOfDate,
      payFrequency,
      employmentEndDate,
      config,
      personalAllowanceOverride,
      previousEmployerVerified:
        priorEmployment.totals.recordCount === 0 ||
        priorEmployment.totals.allVerified,
      includeUnverifiedPreviousInPreview: true,
      previousEmployer: {
        taxableEarnings:
          verified.taxableIncomeYtd +
          sumApprovedAdjustments(adjustmentRows, "PREVIOUS_INCOME"),
        paye:
          verified.payeDeductedYtd +
          sumApprovedAdjustments(adjustmentRows, "PREVIOUS_PAYE"),
        employeeNis: verified.nisEmployeeYtd,
        pensionContribution: 0,
        otherQualifyingContribution: verified.otherApprovedDeductionsYtd,
      },
      currentEmployerActual,
      projectedTaxablePerRemainingPeriod,
      projectedNisPerRemainingPeriod:
        postedPayslips.length > 0
          ? currentEmployerActual.employeeNis / postedPayslips.length
          : 0,
      td1OtherApprovedAnnual: taxProfileSummary.td1OtherApprovedAnnual,
      manualTaxAdjustment,
      formulaOverrides: {
        remainingPeriods: remainingPeriodsOverride,
        nisDeductiblePortion: nisPortionOverride,
        approvedDeductionCapAnnual: deductionCapOverride,
      },
    });

    if (nonTaxableEarningsAdj !== 0) {
      annualProjection.warnings.push(
        `Non-taxable earnings adjustment ${nonTaxableEarningsAdj.toFixed(2)} recorded (does not change PAYE chargeable income).`,
      );
    }
    if (healthSurchargeAdj !== 0) {
      annualProjection.warnings.push(
        `Health surcharge YTD adjustment ${healthSurchargeAdj.toFixed(2)} recorded (informational for payroll; not part of PAYE chargeable income).`,
      );
    }
  }

  const taxYearAdjustments: TaxYearAdjustmentListRow[] = adjustmentRows.map(
    (row) => ({
      id: row.id,
      adjustmentType: row.adjustmentType,
      adjustmentValue: Number(row.adjustmentValue.toString()),
      reason: row.reason,
      status: row.status,
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      enteredByUserId: row.enteredByUserId,
      approvedByUserId: row.approvedByUserId,
      rejectedReason: row.rejectedReason,
      updatedAt: row.updatedAt.toISOString(),
    }),
  );

  return {
    employee: {
      id: employee.id,
      displayName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeNumber: employee.employeeNumber,
      departmentName: employee.department?.name ?? null,
      positionTitle:
        employee.position?.title ?? currentContract?.jobTitle ?? null,
      hireDate: employee.hireDate
        ? employee.hireDate.toISOString().slice(0, 10)
        : null,
    },
    taxYear: year,
    taxProfile,
    taxProfileSummary,
    priorEmployment,
    postedPayslips,
    statutoryOverrides,
    annualProjection,
    savedProjections,
    taxYearAdjustments,
    earningTreatmentOverrides,
    componentOptions: componentDefs,
    projectionContext: {
      payFrequency,
      monthlyBasicSalary,
      contractEndDate,
      currency,
      payeConfigVersionLabel: payeConfig?.versionLabel ?? null,
    },
  };
}
