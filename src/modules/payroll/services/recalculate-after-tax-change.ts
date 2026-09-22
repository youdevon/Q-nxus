/**
 * Cascade after tax inputs change: refresh projection versions and
 * recalculate mutable (draft/approved) pay runs so open payroll picks up
 * the new math. Posted payslips are never rewritten.
 */

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { getEmployeeTaxYearPage } from "@/src/modules/payroll/data/get-employee-tax-year-page";
import { projectionToPersistedFields } from "@/src/modules/payroll/data/get-employee-month-payroll-history";
import { taxYearFromAsOfKey, toStatutoryAsOfKey } from "@/src/modules/payroll/lib/statutory-as-of";
import { recalculateDraftPayRunCore } from "@/src/modules/payroll/services/recalculate-draft-pay-run";
import { notifyPayRunReadyForReview } from "@/src/modules/payroll/services/notify-payroll-events";

const emptyAudit: AuditRequestMetadata = {
  ipAddress: null,
  userAgent: null,
  clientHostName: null,
};

function dec(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

const payRunInclude = {
  payrollPeriod: {
    select: {
      id: true,
      name: true,
      periodStart: true,
      periodEnd: true,
      year: true,
    },
  },
  payslips: {
    select: {
      id: true,
      status: true,
      employeeId: true,
      employeeNumber: true,
      employeeName: true,
      exclusionReason: true,
      excludedAt: true,
      excludedByUserId: true,
      grossPay: true,
      totalDeductions: true,
      netPay: true,
      lineItems: {
        select: {
          lineType: true,
          code: true,
          label: true,
          amount: true,
          isTaxable: true,
          notes: true,
        },
      },
    },
  },
} as const;

export type RecalculateAfterTaxChangeInput = {
  organizationId: string;
  taxYear: number;
  actorUserId: string;
  reason: string;
  /** Employee-scoped cascade. Omit for org-wide. */
  employeeId?: string;
  /**
   * Org-wide: only draft/approved runs whose period end is on/after this date.
   * Defaults to start of taxYear when omitted.
   */
  effectiveFrom?: Date;
  /**
   * When true, skip superseding APPROVED / REVIEW_REQUIRED projection versions
   * (e.g. right after projection approve auto-applies overrides).
   */
  skipProjectionRefresh?: boolean;
  metadata?: AuditRequestMetadata;
};

export type RecalculateAfterTaxChangeResult = {
  draftRunsRecalculated: number;
  draftRunsFailed: number;
  projectionsRefreshed: number;
  payRunIds: string[];
};

function revalidateEmployeePaths(employeeId: string, taxYear: number) {
  try {
    revalidatePath(`/payroll/employees/${employeeId}`);
    revalidatePath(`/payroll/employees/${employeeId}/tax-year`);
    revalidatePath(`/payroll/employees/${employeeId}/payroll/${taxYear}`);
    revalidatePath(`/payroll/employees/${employeeId}/payslip`);
  } catch (error) {
    // Scripts / non-request contexts cannot revalidate; calc must still proceed.
    console.warn("[recalculateAfterTaxChange] revalidatePath skipped:", error);
  }
}

async function refreshProjectionVersion(input: {
  employeeId: string;
  taxYear: number;
  organizationId: string;
  actorUserId: string;
  reason: string;
  metadata: AuditRequestMetadata;
}): Promise<boolean> {
  const latest = await prisma.employeeAnnualPayrollProjection.findFirst({
    where: { employeeId: input.employeeId, taxYear: input.taxYear },
    orderBy: { version: "desc" },
    select: { id: true, version: true, status: true },
  });

  if (
    !latest ||
    (latest.status !== "APPROVED" && latest.status !== "REVIEW_REQUIRED")
  ) {
    return false;
  }

  const page = await getEmployeeTaxYearPage(input.employeeId, input.taxYear);
  if (!page?.annualProjection) {
    return false;
  }

  const fields = projectionToPersistedFields(page.annualProjection);

  await prisma.$transaction(async (tx) => {
    await tx.employeeAnnualPayrollProjection.update({
      where: { id: latest.id },
      data: { status: "SUPERSEDED" },
    });

    await tx.employeeAnnualPayrollProjection.create({
      data: {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        taxYear: input.taxYear,
        calculationDate: new Date(),
        version: latest.version + 1,
        status: "CALCULATED",
        previousEmployerTaxableIncome: dec(fields.previousEmployerTaxableIncome),
        currentEmployerActualTaxableIncome: dec(
          fields.currentEmployerActualTaxableIncome,
        ),
        projectedRemainingTaxableIncome: dec(
          fields.projectedRemainingTaxableIncome,
        ),
        projectedAnnualTaxableIncome: dec(fields.projectedAnnualTaxableIncome),
        projectedEmployeeNis: dec(fields.projectedEmployeeNis),
        projectedQualifyingNis: dec(fields.projectedQualifyingNis),
        projectedPension: dec(fields.projectedPension),
        projectedOtherQualifyingContributions: dec(
          fields.projectedOtherQualifyingContributions,
        ),
        personalAllowance: dec(fields.personalAllowance),
        allowableQualifyingDeduction: dec(fields.allowableQualifyingDeduction),
        projectedChargeableIncome: dec(fields.projectedChargeableIncome),
        projectedAnnualTaxLiability: dec(fields.projectedAnnualTaxLiability),
        previousEmployerPaye: dec(fields.previousEmployerPaye),
        currentEmployerPaye: dec(fields.currentEmployerPaye),
        manualTaxAdjustment: dec(fields.manualTaxAdjustment),
        remainingTaxLiability: dec(fields.remainingTaxLiability),
        remainingPayrollPeriods: fields.remainingPayrollPeriods,
        recommendedPayePerPeriod:
          fields.recommendedPayePerPeriod != null
            ? dec(fields.recommendedPayePerPeriod)
            : null,
        payFrequency: fields.payFrequency,
        warnings: [
          ...fields.warnings,
          `Auto-refreshed after tax change: ${input.reason}.`,
        ],
        calculationSnapshot: fields.calculationSnapshot,
        generatedByUserId: input.actorUserId,
      },
    });
  });

  return true;
}

async function listMutablePayRuns(input: {
  organizationId: string;
  taxYear: number;
  employeeId?: string;
  effectiveFrom: Date;
}) {
  return prisma.payRun.findMany({
    where: {
      organizationId: input.organizationId,
      status: { in: ["DRAFT", "APPROVED"] },
      payrollPeriod: {
        year: input.taxYear,
        periodEnd: { gte: input.effectiveFrom },
      },
      ...(input.employeeId
        ? { payslips: { some: { employeeId: input.employeeId } } }
        : {}),
    },
    include: payRunInclude,
  });
}

/**
 * After an approved tax edit or org rate publish: refresh open projection
 * versions and recalculate mutable pay runs.
 */
export async function recalculateAfterTaxChange(
  input: RecalculateAfterTaxChangeInput,
): Promise<RecalculateAfterTaxChangeResult> {
  const metadata = input.metadata ?? emptyAudit;
  const effectiveFrom =
    input.effectiveFrom ??
    new Date(`${input.taxYear}-01-01T00:00:00.000Z`);

  const result: RecalculateAfterTaxChangeResult = {
    draftRunsRecalculated: 0,
    draftRunsFailed: 0,
    projectionsRefreshed: 0,
    payRunIds: [],
  };

  try {
    const employeeIds = new Set<string>();

    if (input.employeeId) {
      employeeIds.add(input.employeeId);
    } else {
      const projectionEmployees =
        await prisma.employeeAnnualPayrollProjection.findMany({
          where: {
            organizationId: input.organizationId,
            taxYear: input.taxYear,
            status: { in: ["APPROVED", "REVIEW_REQUIRED"] },
          },
          select: { employeeId: true },
          distinct: ["employeeId"],
        });
      for (const row of projectionEmployees) {
        employeeIds.add(row.employeeId);
      }
    }

    for (const employeeId of employeeIds) {
      if (!input.skipProjectionRefresh) {
        const refreshed = await refreshProjectionVersion({
          employeeId,
          taxYear: input.taxYear,
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          reason: input.reason,
          metadata,
        });
        if (refreshed) {
          result.projectionsRefreshed += 1;
        }
      }
      revalidateEmployeePaths(employeeId, input.taxYear);
    }

    const payRuns = await listMutablePayRuns({
      organizationId: input.organizationId,
      taxYear: input.taxYear,
      employeeId: input.employeeId,
      effectiveFrom,
    });

    for (const payRun of payRuns) {
      const hadApproval = Boolean(payRun.approvedAt);
      const recalc = await recalculateDraftPayRunCore({
        payRun,
        actorUserId: input.actorUserId,
        metadata,
        reason: "manual",
      });

      if (!recalc.ok) {
        result.draftRunsFailed += 1;
        console.error(
          `[recalculateAfterTaxChange] pay run ${payRun.id}: ${recalc.message}`,
        );
        continue;
      }

      result.draftRunsRecalculated += 1;
      result.payRunIds.push(payRun.id);
      try {
        revalidatePath(`/payroll/runs/${payRun.id}`);
      } catch (error) {
        console.warn(
          "[recalculateAfterTaxChange] revalidatePath skipped:",
          error,
        );
      }

      if (hadApproval) {
        await notifyPayRunReadyForReview({
          organizationId: input.organizationId,
          payRunId: payRun.id,
          runNumber: payRun.runNumber,
          periodName: payRun.payrollPeriod.name,
          actorUserId: input.actorUserId,
          reason: "approval_cleared",
        });
      }
    }

    try {
      revalidatePath("/payroll/runs");
    } catch (error) {
      console.warn(
        "[recalculateAfterTaxChange] revalidatePath skipped:",
        error,
      );
    }
  } catch (error) {
    console.error("[recalculateAfterTaxChange] failed:", error);
  }

  return result;
}

/** Resolve tax year from an effective-from date for org rate publishes. */
export function taxYearForEffectiveFrom(effectiveFrom: Date): number {
  return taxYearFromAsOfKey(toStatutoryAsOfKey(effectiveFrom));
}
