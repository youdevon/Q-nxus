"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";
import {
  notifyTaxYearAdjustmentDecided,
  notifyTaxYearAdjustmentPending,
} from "@/src/modules/payroll/services/notify-payroll-events";
import { recalculateAfterTaxChange } from "@/src/modules/payroll/services/recalculate-after-tax-change";

export type TaxYearAdjustmentFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

const ADJUSTMENT_TYPES = [
  "PREVIOUS_INCOME",
  "PREVIOUS_PAYE",
  "PERSONAL_ALLOWANCE",
  "TAXABLE_EARNINGS",
  "NON_TAXABLE_EARNINGS",
  "PAYE",
  "NIS",
  "HEALTH_SURCHARGE",
  "PENSION",
  "QUALIFYING_DEDUCTION",
  "PROJECTED_EARNINGS",
  "REMAINING_PERIOD",
  "NIS_DEDUCTIBLE_PORTION",
  "APPROVED_DEDUCTION_CAP",
  "TAX_RATE_INSTRUCTION",
  "OTHER_TAX",
] as const;

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function revalidate(employeeId: string, taxYear: number) {
  revalidatePath(`/payroll/employees/${employeeId}`);
  revalidatePath(`/payroll/employees/${employeeId}/tax-year`);
  revalidatePath(`/payroll/employees/${employeeId}/payroll/${taxYear}`);
}

export async function requestTaxYearAdjustment(
  _previousState: TaxYearAdjustmentFormState,
  formData: FormData,
): Promise<TaxYearAdjustmentFormState> {
  const actor = await requireActor(
    "payroll.tax_adjustments.create",
    "payroll.setup",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const taxYearRaw = textValue(formData, "taxYear");
  const adjustmentType = textValue(formData, "adjustmentType");
  const reason = textValue(formData, "reason");
  const adjustmentValueRaw = textValue(formData, "adjustmentValue");
  const effectiveFromRaw = textValue(formData, "effectiveFrom");
  const fieldErrors: Record<string, string> = {};

  const taxYear = taxYearRaw
    ? Number(taxYearRaw)
    : taxYearFromAsOfKey(toStatutoryAsOfKey(new Date()));
  if (!employeeId) {
    return { status: "error", message: "Missing employee." };
  }
  if (!ADJUSTMENT_TYPES.includes(adjustmentType as (typeof ADJUSTMENT_TYPES)[number])) {
    fieldErrors.adjustmentType = "Select an adjustment type.";
  }
  if (!reason) {
    fieldErrors.reason = "Enter a reason.";
  }
  const adjustmentValue = Number(adjustmentValueRaw);
  if (!Number.isFinite(adjustmentValue)) {
    fieldErrors.adjustmentValue = "Enter a valid adjustment amount.";
  }
  const effectiveFrom =
    parseDate(effectiveFromRaw) ??
    new Date(`${taxYear}-01-01T00:00:00.000Z`);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the adjustment details.",
      fieldErrors,
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

  try {
    let createdId = "";
    await prisma.$transaction(async (transaction) => {
      const created = await transaction.employeeTaxYearAdjustment.create({
        data: {
          organizationId: employee.organizationId,
          employeeId,
          taxYear,
          adjustmentType: adjustmentType as (typeof ADJUSTMENT_TYPES)[number],
          adjustmentValue: new Prisma.Decimal(adjustmentValue.toFixed(2)),
          reason,
          reasonCode: textValue(formData, "reasonCode") || null,
          supportingReference:
            textValue(formData, "supportingReference") || null,
          status: "PENDING_APPROVAL",
          effectiveFrom,
          enteredByUserId: actor.actor.userId,
        },
      });
      createdId = created.id;

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: employee.organizationId,
        moduleKey: "payroll",
        action: "CREATE",
        entityType: "EmployeeTaxYearAdjustment",
        entityId: created.id,
        description: `Requested tax-year adjustment (${adjustmentType}) for ${taxYear}.`,
        newValues: {
          adjustmentType,
          adjustmentValue,
          taxYear,
          status: "PENDING_APPROVAL",
        },
        ...metadata,
      });
    });

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { firstName: true, lastName: true, employeeNumber: true },
    });
    if (emp && createdId) {
      await notifyTaxYearAdjustmentPending({
        organizationId: employee.organizationId,
        employeeId,
        adjustmentId: createdId,
        employeeLabel: `${emp.employeeNumber} — ${emp.firstName} ${emp.lastName}`,
        taxYear,
        adjustmentType,
        actorUserId: actor.actor.userId,
      });
    }

    revalidate(employeeId, taxYear);
    return { status: "success", message: "Adjustment submitted for approval." };
  } catch (error) {
    console.error(error);
    return { status: "error", message: "Unable to save the adjustment." };
  }
}

export async function decideTaxYearAdjustment(
  _previousState: TaxYearAdjustmentFormState,
  formData: FormData,
): Promise<TaxYearAdjustmentFormState> {
  const actor = await requireActor(
    "payroll.tax_adjustments.approve",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const adjustmentId = textValue(formData, "adjustmentId");
  const decision = textValue(formData, "decision");
  const rejectedReason = textValue(formData, "rejectedReason");

  if (!adjustmentId || (decision !== "APPROVE" && decision !== "REJECT")) {
    return { status: "error", message: "Invalid decision." };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const row = await transaction.employeeTaxYearAdjustment.findUnique({
        where: { id: adjustmentId },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeNumber: true,
            },
          },
        },
      });
      if (!row || row.status !== "PENDING_APPROVAL") {
        throw new Error("Adjustment is not pending approval.");
      }
      if (row.enteredByUserId === actor.actor.userId) {
        throw new Error("Maker-checker: you cannot approve your own adjustment.");
      }

      const nextStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const next = await transaction.employeeTaxYearAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: nextStatus,
          approvedByUserId: actor.actor.userId,
          approvedAt: new Date(),
          rejectedReason: decision === "REJECT" ? rejectedReason || "Rejected" : null,
        },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: row.organizationId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeeTaxYearAdjustment",
        entityId: row.id,
        description: `${decision === "APPROVE" ? "Approved" : "Rejected"} tax-year adjustment.`,
        oldValues: { status: row.status },
        newValues: { status: nextStatus },
        ...metadata,
      });

      return { next, row };
    });

    const employeeLabel = `${updated.row.employee.employeeNumber} — ${updated.row.employee.firstName} ${updated.row.employee.lastName}`;
    await notifyTaxYearAdjustmentDecided({
      employeeId: updated.next.employeeId,
      adjustmentId: updated.next.id,
      employeeLabel,
      taxYear: updated.next.taxYear,
      decision: decision === "APPROVE" ? "approve" : "reject",
      enteredByUserId: updated.row.enteredByUserId,
      actorUserId: actor.actor.userId,
    });

    if (decision === "APPROVE") {
      await recalculateAfterTaxChange({
        organizationId: updated.next.organizationId,
        employeeId: updated.next.employeeId,
        taxYear: updated.next.taxYear,
        actorUserId: actor.actor.userId,
        reason: `tax-year adjustment ${updated.next.adjustmentType} approved`,
        metadata,
      });
    }

    revalidate(updated.next.employeeId, updated.next.taxYear);
    return {
      status: "success",
      message:
        decision === "APPROVE" ? "Adjustment approved." : "Adjustment rejected.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Unable to decide adjustment.",
    };
  }
}

export async function listTaxYearAdjustments(
  employeeId: string,
  taxYear: number,
) {
  return prisma.employeeTaxYearAdjustment.findMany({
    where: { employeeId, taxYear },
    orderBy: [{ createdAt: "desc" }],
  });
}
