"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import { getEmployeeTaxYearPage } from "@/src/modules/payroll/data/get-employee-tax-year-page";
import { projectionToPersistedFields } from "@/src/modules/payroll/data/get-employee-month-payroll-history";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";
import {
  notifyAnnualProjectionApproved,
  notifyAnnualProjectionReviewPending,
} from "@/src/modules/payroll/services/notify-payroll-events";
import { applyApprovedProjectionPayeOverrides } from "@/src/modules/payroll/services/apply-annual-paye-projection-overrides";
import { recalculateAfterTaxChange } from "@/src/modules/payroll/services/recalculate-after-tax-change";

export type ProjectionActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function dec(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function revalidateEmployeeTaxPaths(employeeId: string, taxYear: number) {
  revalidatePath(`/payroll/employees/${employeeId}`);
  revalidatePath(`/payroll/employees/${employeeId}/tax-year`);
  revalidatePath(`/payroll/employees/${employeeId}/payroll/${taxYear}`);
}

/** Save a new versioned projection from the live tax-year worksheet. */
export async function saveAnnualPayeProjection(
  _previousState: ProjectionActionState,
  formData: FormData,
): Promise<ProjectionActionState> {
  const actor = await requireActor(
    "payroll.tax_projection.preview",
    "payroll.tax_projection.view",
    "payroll.setup",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const taxYearRaw = textValue(formData, "taxYear");
  const taxYear = taxYearRaw
    ? Number(taxYearRaw)
    : taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));

  if (!employeeId || !Number.isInteger(taxYear)) {
    return { status: "error", message: "Missing employee or tax year." };
  }

  const page = await getEmployeeTaxYearPage(employeeId, taxYear);
  if (!page?.annualProjection) {
    return {
      status: "error",
      message: "No projection could be calculated for this tax year.",
    };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { organizationId: true },
  });
  if (!employee) {
    return { status: "error", message: "Employee not found." };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const fields = projectionToPersistedFields(page.annualProjection);

  try {
    await prisma.$transaction(async (transaction) => {
      const latest = await transaction.employeeAnnualPayrollProjection.findFirst(
        {
          where: { employeeId, taxYear },
          orderBy: { version: "desc" },
          select: { id: true, version: true, status: true },
        },
      );

      if (latest && latest.status === "APPROVED") {
        await transaction.employeeAnnualPayrollProjection.update({
          where: { id: latest.id },
          data: { status: "SUPERSEDED" },
        });
      }

      const version = (latest?.version ?? 0) + 1;
      const created = await transaction.employeeAnnualPayrollProjection.create({
        data: {
          organizationId: employee.organizationId,
          employeeId,
          taxYear,
          calculationDate: new Date(),
          version,
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
          warnings: fields.warnings,
          calculationSnapshot: fields.calculationSnapshot,
          generatedByUserId: actor.actor.userId,
        },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: employee.organizationId,
        moduleKey: "payroll",
        action: "CREATE",
        entityType: "EmployeeAnnualPayrollProjection",
        entityId: created.id,
        description: `Saved annual PAYE projection v${version} for tax year ${taxYear}.`,
        newValues: {
          taxYear,
          version,
          remainingTaxLiability: fields.remainingTaxLiability,
          recommendedPayePerPeriod: fields.recommendedPayePerPeriod,
        },
        ...metadata,
      });
    });

    revalidateEmployeeTaxPaths(employeeId, taxYear);
    return { status: "success", message: "Projection draft saved." };
  } catch (error) {
    console.error(error);
    return { status: "error", message: "Unable to save the projection." };
  }
}

export async function submitAnnualPayeProjectionForReview(
  _previousState: ProjectionActionState,
  formData: FormData,
): Promise<ProjectionActionState> {
  const actor = await requireActor(
    "payroll.tax_projection.preview",
    "payroll.setup",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const projectionId = textValue(formData, "projectionId");
  if (!projectionId) {
    return { status: "error", message: "Missing projection reference." };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const row = await transaction.employeeAnnualPayrollProjection.findUnique({
        where: { id: projectionId },
      });
      if (!row || (row.status !== "CALCULATED" && row.status !== "DRAFT")) {
        throw new Error("Projection cannot be submitted in its current status.");
      }

      const next = await transaction.employeeAnnualPayrollProjection.update({
        where: { id: projectionId },
        data: { status: "REVIEW_REQUIRED" },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: row.organizationId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeeAnnualPayrollProjection",
        entityId: row.id,
        description: `Submitted annual PAYE projection v${row.version} for review.`,
        oldValues: { status: row.status },
        newValues: { status: "REVIEW_REQUIRED" },
        ...metadata,
      });

      return next;
    });

    const emp = await prisma.employee.findUnique({
      where: { id: updated.employeeId },
      select: { firstName: true, lastName: true, employeeNumber: true },
    });
    if (emp) {
      await notifyAnnualProjectionReviewPending({
        organizationId: updated.organizationId,
        employeeId: updated.employeeId,
        projectionId: updated.id,
        employeeLabel: `${emp.employeeNumber} — ${emp.firstName} ${emp.lastName}`,
        taxYear: updated.taxYear,
        version: updated.version,
        actorUserId: actor.actor.userId,
      });
    }

    revalidateEmployeeTaxPaths(updated.employeeId, updated.taxYear);
    return { status: "success", message: "Projection submitted for review." };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Unable to submit projection.",
    };
  }
}

export async function approveAnnualPayeProjection(
  _previousState: ProjectionActionState,
  formData: FormData,
): Promise<ProjectionActionState> {
  const actor = await requireActor(
    "payroll.tax_projection.approve",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const projectionId = textValue(formData, "projectionId");
  if (!projectionId) {
    return { status: "error", message: "Missing projection reference." };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const row = await transaction.employeeAnnualPayrollProjection.findUnique({
        where: { id: projectionId },
      });
      if (!row || row.status !== "REVIEW_REQUIRED") {
        throw new Error("Only projections in review can be approved.");
      }
      if (row.generatedByUserId === actor.actor.userId) {
        throw new Error("Maker-checker: you cannot approve your own projection.");
      }

      await transaction.employeeAnnualPayrollProjection.updateMany({
        where: {
          employeeId: row.employeeId,
          taxYear: row.taxYear,
          status: "APPROVED",
          id: { not: row.id },
        },
        data: { status: "SUPERSEDED" },
      });

      const next = await transaction.employeeAnnualPayrollProjection.update({
        where: { id: projectionId },
        data: {
          status: "APPROVED",
          approvedByUserId: actor.actor.userId,
          approvedAt: new Date(),
        },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: row.organizationId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeeAnnualPayrollProjection",
        entityId: row.id,
        description: `Approved annual PAYE projection v${row.version}.`,
        oldValues: { status: row.status },
        newValues: { status: "APPROVED" },
        ...metadata,
      });

      return { next, row };
    });

    let applySummary:
      | Awaited<ReturnType<typeof applyApprovedProjectionPayeOverrides>>
      | null = null;

    if (updated.next.recommendedPayePerPeriod != null) {
      applySummary = await applyApprovedProjectionPayeOverrides({
        projectionId: updated.next.id,
        actorUserId: actor.actor.userId,
        metadata,
      });

      await recalculateAfterTaxChange({
        organizationId: updated.next.organizationId,
        employeeId: updated.next.employeeId,
        taxYear: updated.next.taxYear,
        actorUserId: actor.actor.userId,
        reason: "annual PAYE projection approved — overrides auto-applied",
        skipProjectionRefresh: true,
        metadata,
      });
    }

    const emp = await prisma.employee.findUnique({
      where: { id: updated.next.employeeId },
      select: { firstName: true, lastName: true, employeeNumber: true },
    });
    if (emp) {
      await notifyAnnualProjectionApproved({
        employeeId: updated.next.employeeId,
        projectionId: updated.next.id,
        employeeLabel: `${emp.employeeNumber} — ${emp.firstName} ${emp.lastName}`,
        taxYear: updated.next.taxYear,
        version: updated.next.version,
        generatedByUserId: updated.row.generatedByUserId,
        actorUserId: actor.actor.userId,
        appliedPeriodCount: applySummary?.appliedPeriodEnds.length ?? 0,
        skippedPostedPeriodCount:
          applySummary?.skippedPostedPeriodEnds.length ?? 0,
        recommendedPayePerPeriod: applySummary?.recommendedPayePerPeriod ?? null,
      });
    }

    revalidateEmployeeTaxPaths(updated.next.employeeId, updated.next.taxYear);

    const applied = applySummary?.appliedPeriodEnds.length ?? 0;
    const skipped = applySummary?.skippedPostedPeriodEnds.length ?? 0;
    const applyNote =
      applied > 0
        ? ` Auto-applied approved PAYE overrides to ${applied} open period(s)${
            skipped > 0 ? ` (${skipped} posted period(s) skipped)` : ""
          } and recalculated draft pay runs.`
        : skipped > 0
          ? ` No open periods to override (${skipped} posted period(s) skipped).`
          : updated.next.recommendedPayePerPeriod == null
            ? " No recommended PAYE per period to apply."
            : "";

    return {
      status: "success",
      message: `Projection approved.${applyNote}`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Unable to approve projection.",
    };
  }
}

/**
 * Re-apply an approved projection’s recommended PAYE to all remaining open
 * periods (APPROVED overrides) and recalculate mutable pay runs.
 */
export async function applyAnnualPayeProjectionToPayroll(
  _previousState: ProjectionActionState,
  formData: FormData,
): Promise<ProjectionActionState> {
  const actor = await requireActor(
    "payroll.tax_projection.apply",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const projectionId = textValue(formData, "projectionId");

  if (!projectionId) {
    return {
      status: "error",
      message: "Projection reference is required.",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const row = await prisma.employeeAnnualPayrollProjection.findUnique({
      where: { id: projectionId },
      select: {
        id: true,
        status: true,
        organizationId: true,
        employeeId: true,
        taxYear: true,
        recommendedPayePerPeriod: true,
      },
    });

    if (!row || row.status !== "APPROVED") {
      throw new Error("Only an approved projection can be applied.");
    }
    if (row.recommendedPayePerPeriod == null) {
      throw new Error("Projection has no recommended PAYE per period.");
    }

    const applySummary = await applyApprovedProjectionPayeOverrides({
      projectionId: row.id,
      actorUserId: actor.actor.userId,
      metadata,
    });

    await recalculateAfterTaxChange({
      organizationId: row.organizationId,
      employeeId: row.employeeId,
      taxYear: row.taxYear,
      actorUserId: actor.actor.userId,
      reason: "annual PAYE projection re-applied to open periods",
      skipProjectionRefresh: true,
      metadata,
    });

    revalidateEmployeeTaxPaths(row.employeeId, row.taxYear);

    const applied = applySummary.appliedPeriodEnds.length;
    const skipped = applySummary.skippedPostedPeriodEnds.length;

    return {
      status: "success",
      message:
        applied > 0
          ? `Applied approved PAYE overrides to ${applied} open period(s)${
              skipped > 0 ? ` (${skipped} posted skipped)` : ""
            } and recalculated draft pay runs.`
          : skipped > 0
            ? `No open periods to override (${skipped} posted period(s) skipped).`
            : "No remaining open periods to override.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Unable to apply projection.",
    };
  }
}
