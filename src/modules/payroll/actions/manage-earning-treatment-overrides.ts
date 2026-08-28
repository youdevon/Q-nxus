"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  notifyEarningTreatmentDecided,
  notifyEarningTreatmentPending,
} from "@/src/modules/payroll/services/notify-payroll-events";
import { recalculateAfterTaxChange } from "@/src/modules/payroll/services/recalculate-after-tax-change";
import {
  taxYearFromAsOfKey,
  toStatutoryAsOfKey,
} from "@/src/modules/payroll/lib/statutory-as-of";

export type EarningTreatmentOverrideFormState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

const TAX_TREATMENTS = [
  "TAXABLE_EMPLOYMENT",
  "NON_TAXABLE",
  "NIS_ONLY",
  "PAYE_EXEMPT",
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

function revalidate(employeeId: string) {
  revalidatePath(`/payroll/employees/${employeeId}`);
  revalidatePath(`/payroll/employees/${employeeId}/tax-year`);
}

export async function requestEarningTreatmentOverride(
  _previousState: EarningTreatmentOverrideFormState,
  formData: FormData,
): Promise<EarningTreatmentOverrideFormState> {
  const actor = await requireActor(
    "payroll.tax_treatment.override",
    "payroll.setup",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const componentDefinitionId = textValue(formData, "componentDefinitionId");
  const taxTreatment = textValue(formData, "taxTreatment");
  const reason = textValue(formData, "reason");
  const effectiveFromRaw = textValue(formData, "effectiveFrom");
  const includeInProjected =
    formData.get("includeInProjectedEarnings") === "on";
  const fieldErrors: Record<string, string> = {};

  if (!employeeId) {
    return { status: "error", message: "Missing employee." };
  }
  if (!componentDefinitionId) {
    fieldErrors.componentDefinitionId = "Select a component.";
  }
  if (!TAX_TREATMENTS.includes(taxTreatment as (typeof TAX_TREATMENTS)[number])) {
    fieldErrors.taxTreatment = "Select a tax treatment.";
  }
  if (!reason) {
    fieldErrors.reason = "Enter a reason.";
  }
  const effectiveFrom =
    parseDate(effectiveFromRaw) ?? new Date();

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the override details.",
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

  const definition = await prisma.payrollComponentDefinition.findFirst({
    where: {
      id: componentDefinitionId,
      organizationId: employee.organizationId,
    },
    select: { id: true },
  });
  if (!definition) {
    return { status: "error", message: "Component not found." };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    let createdId = "";
    await prisma.$transaction(async (transaction) => {
      const created = await transaction.employeeEarningTreatmentOverride.create({
        data: {
          organizationId: employee.organizationId,
          employeeId,
          componentDefinitionId,
          taxTreatment: taxTreatment as (typeof TAX_TREATMENTS)[number],
          includeInProjectedEarnings: includeInProjected,
          reason,
          supportingReference:
            textValue(formData, "supportingReference") || null,
          effectiveFrom,
          effectiveTo: parseDate(textValue(formData, "effectiveTo")),
          status: "PENDING_APPROVAL",
          enteredByUserId: actor.actor.userId,
        },
      });
      createdId = created.id;

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: employee.organizationId,
        moduleKey: "payroll",
        action: "CREATE",
        entityType: "EmployeeEarningTreatmentOverride",
        entityId: created.id,
        description: `Requested earning treatment override (${taxTreatment}).`,
        newValues: {
          componentDefinitionId,
          taxTreatment,
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
      await notifyEarningTreatmentPending({
        organizationId: employee.organizationId,
        employeeId,
        overrideId: createdId,
        employeeLabel: `${emp.employeeNumber} — ${emp.firstName} ${emp.lastName}`,
        taxTreatment,
        actorUserId: actor.actor.userId,
      });
    }

    revalidate(employeeId);
    return { status: "success", message: "Treatment override submitted." };
  } catch (error) {
    console.error(error);
    return { status: "error", message: "Unable to save the override." };
  }
}

export async function decideEarningTreatmentOverride(
  _previousState: EarningTreatmentOverrideFormState,
  formData: FormData,
): Promise<EarningTreatmentOverrideFormState> {
  const actor = await requireActor(
    "payroll.tax_treatment.override",
    "payroll.manage",
  );
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const overrideId = textValue(formData, "overrideId");
  const decision = textValue(formData, "decision");

  if (!overrideId || (decision !== "APPROVE" && decision !== "REJECT")) {
    return { status: "error", message: "Invalid decision." };
  }

  const metadata = await getAuditRequestMetadata(formData);

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const row = await transaction.employeeEarningTreatmentOverride.findUnique({
        where: { id: overrideId },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeNumber: true,
              organizationId: true,
            },
          },
        },
      });
      if (!row || row.status !== "PENDING_APPROVAL") {
        throw new Error("Override is not pending approval.");
      }
      if (row.enteredByUserId === actor.actor.userId) {
        throw new Error("Maker-checker: you cannot approve your own override.");
      }

      const nextStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const next = await transaction.employeeEarningTreatmentOverride.update({
        where: { id: overrideId },
        data: {
          status: nextStatus,
          approvedByUserId: actor.actor.userId,
          approvedAt: new Date(),
        },
      });

      await recordAuditEvent(transaction, {
        userId: actor.actor.userId,
        organizationId: row.organizationId,
        moduleKey: "payroll",
        action: "UPDATE",
        entityType: "EmployeeEarningTreatmentOverride",
        entityId: row.id,
        description: `${decision === "APPROVE" ? "Approved" : "Rejected"} earning treatment override.`,
        oldValues: { status: row.status },
        newValues: { status: nextStatus },
        ...metadata,
      });

      return { next, row };
    });

    const employeeLabel = `${updated.row.employee.employeeNumber} — ${updated.row.employee.firstName} ${updated.row.employee.lastName}`;
    await notifyEarningTreatmentDecided({
      employeeId: updated.next.employeeId,
      overrideId: updated.next.id,
      employeeLabel,
      decision: decision === "APPROVE" ? "approve" : "reject",
      enteredByUserId: updated.row.enteredByUserId,
      actorUserId: actor.actor.userId,
    });

    if (decision === "APPROVE") {
      const taxYear = taxYearFromAsOfKey(
        toStatutoryAsOfKey(updated.row.effectiveFrom),
      );
      await recalculateAfterTaxChange({
        organizationId: updated.row.organizationId,
        employeeId: updated.next.employeeId,
        taxYear,
        actorUserId: actor.actor.userId,
        reason: "earning treatment override approved",
        effectiveFrom: updated.row.effectiveFrom,
        metadata,
      });
    }

    revalidate(updated.next.employeeId);
    return {
      status: "success",
      message:
        decision === "APPROVE" ? "Override approved." : "Override rejected.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Unable to decide override.",
    };
  }
}
