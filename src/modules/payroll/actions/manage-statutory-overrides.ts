"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";
import {
  notifyStatutoryOverrideDecided,
  notifyStatutoryOverridePending,
} from "@/src/modules/payroll/services/notify-payroll-events";
import { recalculateAfterTaxChange } from "@/src/modules/payroll/services/recalculate-after-tax-change";

export type StatutoryOverrideFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

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

function parseOptionalAmount(
  value: string,
  field: string,
  fieldErrors: Record<string, string>,
): number | null {
  if (!value) {
    return null;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    fieldErrors[field] = "Enter a valid amount.";
    return null;
  }
  return amount;
}

function toDecimal(value: number | null): Prisma.Decimal | null {
  if (value == null) {
    return null;
  }
  return new Prisma.Decimal(value.toFixed(2));
}

export async function requestStatutoryOverride(
  _previousState: StatutoryOverrideFormState,
  formData: FormData,
): Promise<StatutoryOverrideFormState> {
  const actor = await requireActor(
    "payroll.manage",
    "payroll.statutory_override.request",
    "payroll.setup",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const periodEndRaw = textValue(formData, "periodEnd");
  const reason = textValue(formData, "reason");
  const fieldErrors: Record<string, string> = {};

  if (!employeeId) {
    return { status: "error", message: "Missing employee reference." };
  }
  const periodEnd = parseDate(periodEndRaw);
  if (!periodEnd) {
    fieldErrors.periodEnd = "Enter period end (YYYY-MM-DD).";
  }
  if (!reason || reason.length < 5) {
    fieldErrors.reason = "Provide a reason (at least 5 characters).";
  }

  const payeAmount = parseOptionalAmount(
    textValue(formData, "payeAmount"),
    "payeAmount",
    fieldErrors,
  );
  const nisEmployeeAmount = parseOptionalAmount(
    textValue(formData, "nisEmployeeAmount"),
    "nisEmployeeAmount",
    fieldErrors,
  );
  const healthSurchargeAmount = parseOptionalAmount(
    textValue(formData, "healthSurchargeAmount"),
    "healthSurchargeAmount",
    fieldErrors,
  );

  if (
    payeAmount == null &&
    nisEmployeeAmount == null &&
    healthSurchargeAmount == null
  ) {
    fieldErrors.payeAmount = "Set at least one override amount.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the override request.",
      fieldErrors,
    };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  });
  if (!employee) {
    return { status: "error", message: "Employee not found." };
  }

  const periodEndKey = toStatutoryAsOfKey(periodEnd!);
  const taxYear = taxYearFromAsOfKey(periodEndKey);
  const metadata = await getAuditRequestMetadata(formData);
  const submitForApproval = formData.get("submitForApproval") === "on";
  let savedOverrideId: string | null = null;

  try {
    await prisma.$transaction(async (transaction) => {
      const row = await transaction.employeePayrollStatutoryOverride.upsert({
        where: {
          employeeId_periodEnd: {
            employeeId: employee.id,
            periodEnd: periodEnd!,
          },
        },
        create: {
          organizationId: employee.organizationId,
          employeeId: employee.id,
          taxYear,
          periodEnd: periodEnd!,
          payeAmount: toDecimal(payeAmount),
          nisEmployeeAmount: toDecimal(nisEmployeeAmount),
          healthSurchargeAmount: toDecimal(healthSurchargeAmount),
          reason,
          status: submitForApproval ? "PENDING_APPROVAL" : "DRAFT",
          requestedByUserId: actor.actor.userId,
        },
        update: {
          payeAmount: toDecimal(payeAmount),
          nisEmployeeAmount: toDecimal(nisEmployeeAmount),
          healthSurchargeAmount: toDecimal(healthSurchargeAmount),
          reason,
          status: submitForApproval ? "PENDING_APPROVAL" : "DRAFT",
          approvedByUserId: null,
          approvedAt: null,
          rejectedReason: null,
          requestedByUserId: actor.actor.userId,
        },
        select: { id: true, status: true },
      });

      savedOverrideId = row.id;

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: employee.organizationId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeePayrollStatutoryOverride",
        entityId: row.id,
        description: `Statutory override ${row.status.toLowerCase()} for ${employee.firstName} ${employee.lastName} · ${periodEndKey}.`,
        newValues: {
          periodEnd: periodEndKey,
          payeAmount,
          nisEmployeeAmount,
          healthSurchargeAmount,
          status: row.status,
        },
        ...metadata,
      });
    });
  } catch (error) {
    console.error("Unable to save statutory override:", error);
    return {
      status: "error",
      message: "Unable to save the override. Try again.",
    };
  }

  if (submitForApproval && savedOverrideId) {
    await notifyStatutoryOverridePending({
      organizationId: employee.organizationId,
      employeeId: employee.id,
      overrideId: savedOverrideId,
      employeeLabel: `${employee.employeeNumber} — ${employee.firstName} ${employee.lastName}`,
      periodEndKey,
      actorUserId: actor.actor.userId,
    });
  }

  revalidatePath(`/payroll/employees/${employee.id}`);
  revalidatePath(`/payroll/employees/${employee.id}/tax-year`);
  return {
    status: "success",
    message: submitForApproval
      ? "Override submitted for approval."
      : "Override draft saved.",
  };
}

/** Move a DRAFT statutory override to PENDING_APPROVAL and notify approvers. */
export async function submitStatutoryOverrideForApproval(
  _previousState: StatutoryOverrideFormState,
  formData: FormData,
): Promise<StatutoryOverrideFormState> {
  const actor = await requireActor(
    "payroll.manage",
    "payroll.statutory_override.request",
    "payroll.setup",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const overrideId = textValue(formData, "overrideId");
  if (!overrideId) {
    return { status: "error", message: "Missing override reference." };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const existing = await prisma.employeePayrollStatutoryOverride.findUnique({
      where: { id: overrideId },
      include: {
        employee: {
          select: {
            id: true,
            organizationId: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
      },
    });

    if (!existing || existing.status !== "DRAFT") {
      return {
        status: "error",
        message: "Only draft overrides can be submitted for approval.",
      };
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.employeePayrollStatutoryOverride.update({
        where: { id: existing.id },
        data: {
          status: "PENDING_APPROVAL",
          requestedByUserId: actor.actor.userId,
          approvedByUserId: null,
          approvedAt: null,
          rejectedReason: null,
        },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: existing.employee.organizationId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeePayrollStatutoryOverride",
        entityId: existing.id,
        description: `Submitted statutory override for approval (${existing.employee.firstName} ${existing.employee.lastName}).`,
        oldValues: { status: existing.status },
        newValues: { status: "PENDING_APPROVAL" },
        ...metadata,
      });
    });

    const periodEndKey = existing.periodEnd.toISOString().slice(0, 10);
    await notifyStatutoryOverridePending({
      organizationId: existing.employee.organizationId,
      employeeId: existing.employee.id,
      overrideId: existing.id,
      employeeLabel: `${existing.employee.employeeNumber} — ${existing.employee.firstName} ${existing.employee.lastName}`,
      periodEndKey,
      actorUserId: actor.actor.userId,
    });

    revalidatePath(`/payroll/employees/${existing.employee.id}`);
    revalidatePath(`/payroll/employees/${existing.employee.id}/tax-year`);
    return {
      status: "success",
      message: "Override submitted for approval.",
    };
  } catch (error) {
    console.error("Unable to submit statutory override:", error);
    return { status: "error", message: "Unable to submit the override." };
  }
}

export async function decideStatutoryOverride(
  _previousState: StatutoryOverrideFormState,
  formData: FormData,
): Promise<StatutoryOverrideFormState> {
  const actor = await requireActor(
    "payroll.manage",
    "payroll.statutory_override.approve",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const overrideId = textValue(formData, "overrideId");
  const decision = textValue(formData, "decision");
  const rejectedReason = textValue(formData, "rejectedReason");

  if (!overrideId || (decision !== "approve" && decision !== "reject")) {
    return { status: "error", message: "Invalid override decision." };
  }

  const existing = await prisma.employeePayrollStatutoryOverride.findUnique({
    where: { id: overrideId },
    include: {
      employee: {
        select: {
          id: true,
          organizationId: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
    },
  });

  if (!existing || existing.status !== "PENDING_APPROVAL") {
    return {
      status: "error",
      message: "Override is not pending approval.",
    };
  }

  if (existing.requestedByUserId === actor.actor.userId) {
    return {
      status: "error",
      message: "Requester cannot approve their own override (maker-checker).",
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.employeePayrollStatutoryOverride.update({
        where: { id: existing.id },
        data:
          decision === "approve"
            ? {
                status: "APPROVED",
                approvedByUserId: actor.actor.userId,
                approvedAt: new Date(),
                rejectedReason: null,
              }
            : {
                status: "REJECTED",
                approvedByUserId: actor.actor.userId,
                approvedAt: new Date(),
                rejectedReason: rejectedReason || "Rejected",
              },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: existing.employee.organizationId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeePayrollStatutoryOverride",
        entityId: existing.id,
        description: `Statutory override ${decision}d for ${existing.employee.firstName} ${existing.employee.lastName}.`,
        newValues: { decision, rejectedReason: rejectedReason || null },
        ...metadata,
      });
    });
  } catch (error) {
    console.error("Unable to decide statutory override:", error);
    return { status: "error", message: "Unable to update the override." };
  }

  revalidatePath(`/payroll/employees/${existing.employee.id}`);
  revalidatePath(`/payroll/employees/${existing.employee.id}/tax-year`);

  await notifyStatutoryOverrideDecided({
    employeeId: existing.employee.id,
    overrideId: existing.id,
    employeeLabel: `${existing.employee.employeeNumber} — ${existing.employee.firstName} ${existing.employee.lastName}`,
    decision: decision as "approve" | "reject",
    requestedByUserId: existing.requestedByUserId,
    actorUserId: actor.actor.userId,
  });

  if (decision === "approve") {
    await recalculateAfterTaxChange({
      organizationId: existing.employee.organizationId,
      employeeId: existing.employee.id,
      taxYear: existing.taxYear,
      actorUserId: actor.actor.userId,
      reason: "statutory override approved",
      effectiveFrom: existing.periodEnd,
      metadata,
    });
  }

  return {
    status: "success",
    message: decision === "approve" ? "Override approved." : "Override rejected.",
  };
}
