/**
 * Apply an approved annual PAYE projection as APPROVED statutory PAYE overrides
 * for every remaining open monthly period (skipping posted payslips).
 */

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { AuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { listRemainingMonthlyPeriodEnds, filterOpenPeriodEnds } from "@/src/modules/payroll/lib/remaining-payroll-periods";
import { toStatutoryAsOfKey } from "@/src/modules/payroll/lib/statutory-as-of";

export type ApplyApprovedProjectionPayeOverridesResult = {
  appliedPeriodEnds: string[];
  skippedPostedPeriodEnds: string[];
  overrideIds: string[];
  recommendedPayePerPeriod: number;
};

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function readSnapshotPeriodBounds(snapshot: unknown): {
  asOfDate: Date | null;
  projectionEndDate: Date | null;
} {
  if (!snapshot || typeof snapshot !== "object") {
    return { asOfDate: null, projectionEndDate: null };
  }

  const periods = (snapshot as { periods?: unknown }).periods;
  if (!periods || typeof periods !== "object") {
    return { asOfDate: null, projectionEndDate: null };
  }

  const asOfRaw = (periods as { asOfDate?: unknown }).asOfDate;
  const endRaw = (periods as { projectionEndDate?: unknown }).projectionEndDate;

  const asOfDate =
    typeof asOfRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw)
      ? new Date(`${asOfRaw}T00:00:00.000Z`)
      : null;
  const projectionEndDate =
    typeof endRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endRaw)
      ? new Date(`${endRaw}T00:00:00.000Z`)
      : null;

  return {
    asOfDate:
      asOfDate && !Number.isNaN(asOfDate.getTime()) ? asOfDate : null,
    projectionEndDate:
      projectionEndDate && !Number.isNaN(projectionEndDate.getTime())
        ? projectionEndDate
        : null,
  };
}

export async function applyApprovedProjectionPayeOverrides(input: {
  projectionId: string;
  actorUserId: string;
  metadata: AuditRequestMetadata;
}): Promise<ApplyApprovedProjectionPayeOverridesResult> {
  const row = await prisma.employeeAnnualPayrollProjection.findUnique({
    where: { id: input.projectionId },
  });

  if (!row || row.status !== "APPROVED") {
    throw new Error("Only an approved projection can be applied.");
  }

  if (row.recommendedPayePerPeriod == null) {
    throw new Error("Projection has no recommended PAYE per period.");
  }

  const recommended = Number(row.recommendedPayePerPeriod.toString());
  const snapshotBounds = readSnapshotPeriodBounds(row.calculationSnapshot);
  const asOfDate = snapshotBounds.asOfDate ?? row.calculationDate;
  const projectionEndDate =
    snapshotBounds.projectionEndDate ??
    new Date(Date.UTC(row.taxYear, 11, 31));

  const periodEnds = listRemainingMonthlyPeriodEnds({
    taxYear: row.taxYear,
    asOfDate,
    projectionEndDate,
  });

  const posted = await prisma.payslip.findMany({
    where: {
      employeeId: row.employeeId,
      status: "POSTED",
      payrollPeriod: {
        periodEnd: { in: periodEnds },
      },
    },
    select: {
      payrollPeriod: {
        select: { periodEnd: true },
      },
    },
  });

  const postedKeys = new Set(
    posted.map((slip) => isoDate(slip.payrollPeriod.periodEnd)),
  );
  const { open, skippedPosted } = filterOpenPeriodEnds(periodEnds, postedKeys);

  const payeAmount = new Prisma.Decimal(recommended.toFixed(2));
  const reason = `Auto-applied from approved annual PAYE projection v${row.version}.`;
  const overrideIds: string[] = [];
  const appliedPeriodEnds: string[] = [];
  let lastOverrideId: string | null = null;
  let lastPeriodEnd: Date | null = null;

  await prisma.$transaction(async (transaction) => {
    for (const periodEnd of open) {
      const override = await transaction.employeePayrollStatutoryOverride.upsert(
        {
          where: {
            employeeId_periodEnd: {
              employeeId: row.employeeId,
              periodEnd,
            },
          },
          create: {
            organizationId: row.organizationId,
            employeeId: row.employeeId,
            taxYear: row.taxYear,
            periodEnd,
            payeAmount,
            reason,
            status: "APPROVED",
            requestedByUserId: input.actorUserId,
            approvedByUserId: input.actorUserId,
            approvedAt: new Date(),
          },
          update: {
            payeAmount,
            reason,
            status: "APPROVED",
            requestedByUserId: input.actorUserId,
            approvedByUserId: input.actorUserId,
            approvedAt: new Date(),
            rejectedReason: null,
          },
        },
      );

      overrideIds.push(override.id);
      appliedPeriodEnds.push(isoDate(periodEnd));
      lastOverrideId = override.id;
      lastPeriodEnd = periodEnd;
    }

    await transaction.employeeAnnualPayrollProjection.update({
      where: { id: row.id },
      data: {
        ...(lastPeriodEnd
          ? {
              appliedToPeriodEnd: lastPeriodEnd,
              appliedStatutoryOverrideId: lastOverrideId,
            }
          : {}),
      },
    });

    await recordAuditEvent(transaction, {
      userId: input.actorUserId,
      organizationId: row.organizationId,
      moduleKey: "payroll",
      action: "UPDATE",
      entityType: "EmployeeAnnualPayrollProjection",
      entityId: row.id,
      description: `Auto-applied annual PAYE projection v${row.version} to ${appliedPeriodEnds.length} open period(s).`,
      newValues: {
        recommendedPayePerPeriod: recommended,
        appliedPeriodEnds,
        skippedPostedPeriodEnds: skippedPosted.map(isoDate),
        asOfDate: toStatutoryAsOfKey(asOfDate),
        projectionEndDate: toStatutoryAsOfKey(projectionEndDate),
      },
      ...input.metadata,
    });
  });

  return {
    appliedPeriodEnds,
    skippedPostedPeriodEnds: skippedPosted.map(isoDate),
    overrideIds,
    recommendedPayePerPeriod: recommended,
  };
}
