"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { recordAuditEvent } from "@/src/modules/audit/services/record-audit-event";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  expectedKindForCategory,
  type RecurringComponentCategory,
  type RecurringComponentKind,
} from "@/src/modules/payroll/lib/recurring-payroll-items";
import { resolvePayrollOrganization } from "@/src/modules/payroll/lib/resolve-payroll-organization";

export type PayrollComponentFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

const CATEGORIES = new Set<RecurringComponentCategory>([
  "LOAN",
  "GARNISHMENT",
  "PENSION_INSTALLMENT",
  "VOLUNTARY_DEDUCTION",
  "RECURRING_EARNING",
]);

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value.length > 0 ? value : null;
}

function parseMoney(
  value: string,
  field: string,
  fieldErrors: Record<string, string>,
  options?: { allowEmpty?: boolean },
): number | null {
  if (!value) {
    if (options?.allowEmpty) {
      return null;
    }
    fieldErrors[field] = "Enter a valid amount.";
    return null;
  }

  const amount = Number(value.replaceAll(",", ""));
  if (!Number.isFinite(amount) || amount < 0) {
    fieldErrors[field] = "Enter a valid amount.";
    return null;
  }

  return Math.round(amount * 100) / 100;
}

function normalizeCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^A-Z0-9_-]/g, "");
}

function parseCategory(
  value: string,
  fieldErrors: Record<string, string>,
): RecurringComponentCategory | null {
  const normalized = value.toUpperCase() as RecurringComponentCategory;
  if (!CATEGORIES.has(normalized)) {
    fieldErrors.category = "Select a valid category.";
    return null;
  }
  return normalized;
}

function revalidateComponentPaths(employeeId?: string) {
  revalidatePath("/payroll/settings");
  revalidatePath("/payroll/settings/components");
  if (employeeId) {
    revalidatePath(`/payroll/employees/${employeeId}`);
    revalidatePath(`/payroll/employees/${employeeId}/payslip`);
  }
}

export async function savePayrollComponentDefinition(
  _previous: PayrollComponentFormState,
  formData: FormData,
): Promise<PayrollComponentFormState> {
  const actor = await requireActor("payroll.setup", "payroll.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const organization = await resolvePayrollOrganization({
    actorUserId: actor.actor.userId,
  });

  const fieldErrors: Record<string, string> = {};
  const category = parseCategory(textValue(formData, "category"), fieldErrors);
  const code = normalizeCode(textValue(formData, "code"));
  const name = textValue(formData, "name");
  const id = textValue(formData, "id");

  if (!code) {
    fieldErrors.code = "Code is required.";
  }
  if (!name) {
    fieldErrors.name = "Name is required.";
  }

  const defaultAmount = parseMoney(
    textValue(formData, "defaultAmount"),
    "defaultAmount",
    fieldErrors,
    { allowEmpty: true },
  );
  const taxTreatmentRaw = textValue(formData, "taxTreatment");
  const taxTreatment =
    taxTreatmentRaw === "TAXABLE_EMPLOYMENT" ||
    taxTreatmentRaw === "NON_TAXABLE" ||
    taxTreatmentRaw === "NIS_ONLY" ||
    taxTreatmentRaw === "PAYE_EXEMPT"
      ? taxTreatmentRaw
      : "NON_TAXABLE";
  // Keep legacy isTaxable in sync with TAXABLE_EMPLOYMENT treatment.
  const isTaxable = taxTreatment === "TAXABLE_EMPLOYMENT";
  const isActive = formData.get("isActive") === "on";

  if (Object.keys(fieldErrors).length > 0 || !category) {
    return {
      status: "error",
      message: "Fix the highlighted fields.",
      fieldErrors,
    };
  }

  const kind: RecurringComponentKind = expectedKindForCategory(category);
  const metadata = await getAuditRequestMetadata(formData);

  if (id) {
    const existing = await prisma.payrollComponentDefinition.findFirst({
      where: { id, organizationId: organization.id },
    });
    if (!existing) {
      return { status: "error", message: "Component definition not found." };
    }

    const duplicate = await prisma.payrollComponentDefinition.findFirst({
      where: {
        organizationId: organization.id,
        code,
        id: { not: id },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        status: "error",
        message: "Another component already uses this code.",
        fieldErrors: { code: "Code must be unique." },
      };
    }

    const updated = await prisma.payrollComponentDefinition.update({
      where: { id },
      data: {
        code,
        name,
        kind,
        category,
        isTaxable,
        taxTreatment,
        isActive,
        defaultAmount:
          defaultAmount != null
            ? new Prisma.Decimal(defaultAmount)
            : null,
      },
    });

    await recordAuditEvent(prisma, {
      userId: actor.actor.userId,
      organizationId: organization.id,
      moduleKey: "payroll",
      action: "UPDATE",
      entityType: "PayrollComponentDefinition",
      entityId: updated.id,
      description: `Updated payroll component ${updated.code} (${updated.name}).`,
      oldValues: {
        code: existing.code,
        name: existing.name,
        kind: existing.kind,
        category: existing.category,
        isTaxable: existing.isTaxable,
        taxTreatment: existing.taxTreatment,
        isActive: existing.isActive,
        defaultAmount: existing.defaultAmount?.toString() ?? null,
      },
      newValues: {
        code: updated.code,
        name: updated.name,
        kind: updated.kind,
        category: updated.category,
        isTaxable: updated.isTaxable,
        taxTreatment: updated.taxTreatment,
        isActive: updated.isActive,
        defaultAmount: updated.defaultAmount?.toString() ?? null,
      },
      ...metadata,
    });

    revalidateComponentPaths();
    return { status: "success", message: "Component definition updated." };
  }

  const duplicate = await prisma.payrollComponentDefinition.findFirst({
    where: { organizationId: organization.id, code },
    select: { id: true },
  });
  if (duplicate) {
    return {
      status: "error",
      message: "Another component already uses this code.",
      fieldErrors: { code: "Code must be unique." },
    };
  }

  const created = await prisma.payrollComponentDefinition.create({
    data: {
      organizationId: organization.id,
      code,
      name,
      kind,
      category,
      isTaxable,
      taxTreatment,
      isActive,
      defaultAmount:
        defaultAmount != null ? new Prisma.Decimal(defaultAmount) : null,
    },
  });

  await recordAuditEvent(prisma, {
    userId: actor.actor.userId,
    organizationId: organization.id,
    moduleKey: "payroll",
    action: "CREATE",
    entityType: "PayrollComponentDefinition",
    entityId: created.id,
    description: `Created payroll component ${created.code} (${created.name}).`,
    newValues: {
      code: created.code,
      name: created.name,
      kind: created.kind,
      category: created.category,
      isTaxable: created.isTaxable,
      taxTreatment: created.taxTreatment,
      isActive: created.isActive,
      defaultAmount: created.defaultAmount?.toString() ?? null,
    },
    ...metadata,
  });

  revalidateComponentPaths();
  return { status: "success", message: "Component definition created." };
}

export async function saveEmployeeRecurringItem(
  _previous: PayrollComponentFormState,
  formData: FormData,
): Promise<PayrollComponentFormState> {
  const actor = await requireActor("payroll.setup", "payroll.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const organization = await resolvePayrollOrganization({
    actorUserId: actor.actor.userId,
  });

  const id = textValue(formData, "id");
  const employeeId = textValue(formData, "employeeId");
  const definitionId = textValue(formData, "definitionId");
  const fieldErrors: Record<string, string> = {};

  if (!employeeId) {
    return { status: "error", message: "Employee is required." };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId: organization.id },
    select: { id: true },
  });
  if (!employee) {
    return { status: "error", message: "Employee not found." };
  }

  const amount = parseMoney(textValue(formData, "amount"), "amount", fieldErrors);
  const remainingBalance = parseMoney(
    textValue(formData, "remainingBalance"),
    "remainingBalance",
    fieldErrors,
    { allowEmpty: true },
  );
  const startDateRaw = textValue(formData, "startDate");
  const endDateRaw = nullableText(formData, "endDate");
  const notes = nullableText(formData, "notes");
  const isActive = formData.get("isActive") === "on";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateRaw)) {
    fieldErrors.startDate = "Enter a valid start date.";
  }
  if (endDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)) {
    fieldErrors.endDate = "Enter a valid end date.";
  }
  if (!definitionId && !id) {
    fieldErrors.definitionId = "Select a component.";
  }

  if (Object.keys(fieldErrors).length > 0 || amount == null) {
    return {
      status: "error",
      message: "Fix the highlighted fields.",
      fieldErrors,
    };
  }

  const startDate = new Date(`${startDateRaw}T00:00:00.000Z`);
  const endDate = endDateRaw
    ? new Date(`${endDateRaw}T00:00:00.000Z`)
    : null;
  if (endDate && endDate < startDate) {
    return {
      status: "error",
      message: "End date must be on or after the start date.",
      fieldErrors: { endDate: "End date must be on or after start date." },
    };
  }

  const metadata = await getAuditRequestMetadata(formData);

  if (id) {
    const existing = await prisma.employeePayrollRecurringItem.findFirst({
      where: {
        id,
        employeeId,
        organizationId: organization.id,
      },
    });
    if (!existing) {
      return { status: "error", message: "Recurring assignment not found." };
    }

    const updated = await prisma.employeePayrollRecurringItem.update({
      where: { id },
      data: {
        amount: new Prisma.Decimal(amount),
        remainingBalance:
          remainingBalance != null
            ? new Prisma.Decimal(remainingBalance)
            : null,
        startDate,
        endDate,
        isActive,
        notes,
      },
    });

    await recordAuditEvent(prisma, {
      userId: actor.actor.userId,
      organizationId: organization.id,
      moduleKey: "payroll",
      action: "UPDATE",
      entityType: "EmployeePayrollRecurringItem",
      entityId: updated.id,
      description: `Updated recurring payroll item for employee ${employeeId}.`,
      oldValues: {
        amount: existing.amount.toString(),
        remainingBalance: existing.remainingBalance?.toString() ?? null,
        startDate: existing.startDate.toISOString().slice(0, 10),
        endDate: existing.endDate?.toISOString().slice(0, 10) ?? null,
        isActive: existing.isActive,
      },
      newValues: {
        amount: updated.amount.toString(),
        remainingBalance: updated.remainingBalance?.toString() ?? null,
        startDate: updated.startDate.toISOString().slice(0, 10),
        endDate: updated.endDate?.toISOString().slice(0, 10) ?? null,
        isActive: updated.isActive,
      },
      ...metadata,
    });

    revalidateComponentPaths(employeeId);
    return { status: "success", message: "Recurring item updated." };
  }

  const definition = await prisma.payrollComponentDefinition.findFirst({
    where: {
      id: definitionId,
      organizationId: organization.id,
      isActive: true,
    },
    select: { id: true, code: true, name: true },
  });
  if (!definition) {
    return {
      status: "error",
      message: "Select an active component definition.",
      fieldErrors: { definitionId: "Select an active component." },
    };
  }

  const created = await prisma.employeePayrollRecurringItem.create({
    data: {
      organizationId: organization.id,
      employeeId,
      definitionId: definition.id,
      amount: new Prisma.Decimal(amount),
      remainingBalance:
        remainingBalance != null
          ? new Prisma.Decimal(remainingBalance)
          : null,
      startDate,
      endDate,
      isActive,
      notes,
      createdById: actor.actor.userId,
    },
  });

  await recordAuditEvent(prisma, {
    userId: actor.actor.userId,
    organizationId: organization.id,
    moduleKey: "payroll",
    action: "CREATE",
    entityType: "EmployeePayrollRecurringItem",
    entityId: created.id,
    description: `Assigned ${definition.code} (${definition.name}) to employee ${employeeId}.`,
    newValues: {
      definitionId: definition.id,
      amount: created.amount.toString(),
      remainingBalance: created.remainingBalance?.toString() ?? null,
      startDate: created.startDate.toISOString().slice(0, 10),
      endDate: created.endDate?.toISOString().slice(0, 10) ?? null,
      isActive: created.isActive,
    },
    ...metadata,
  });

  revalidateComponentPaths(employeeId);
  return { status: "success", message: "Recurring item assigned." };
}
