"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  completeOffboardingTask,
  completeOnboardingTask,
  cancelEmployeeOffboardingCase,
  cancelEmployeeOnboardingCase,
  openEmployeeOffboardingCase,
  openEmployeeOnboardingCase,
} from "@/src/modules/hr/services/employee-lifecycle-cases";

export type LifecycleActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function startEmployeeOnboarding(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, organizationId: true },
  });

  if (!employee) {
    return { status: "error", message: "Employee not found." };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const opened = await openEmployeeOnboardingCase({
    organizationId: employee.organizationId,
    employeeId,
    openedByUserId: actor.actor.userId,
    notes: textValue(formData, "notes") || null,
  });

  await prisma.auditEvent.create({
    data: {
      userId: actor.actor.userId,
      moduleKey: "hr",
      action: "CREATE",
      entityType: "EmployeeOnboardingCase",
      entityId: opened.id,
      description: "Opened employee onboarding case.",
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      clientHostName: metadata.clientHostName,
    },
  });

  revalidatePath(`/people/employees/${employeeId}`);
  return { status: "success", message: "Onboarding case opened." };
}

export async function startEmployeeOffboarding(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const employeeId = textValue(formData, "employeeId");
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, organizationId: true },
  });

  if (!employee) {
    return { status: "error", message: "Employee not found." };
  }

  const metadata = await getAuditRequestMetadata(formData);
  const opened = await openEmployeeOffboardingCase({
    organizationId: employee.organizationId,
    employeeId,
    openedByUserId: actor.actor.userId,
    reason: textValue(formData, "reason") || null,
    notes: textValue(formData, "notes") || null,
  });

  await prisma.auditEvent.create({
    data: {
      userId: actor.actor.userId,
      moduleKey: "hr",
      action: "CREATE",
      entityType: "EmployeeOffboardingCase",
      entityId: opened.id,
      description: "Opened employee offboarding case.",
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      clientHostName: metadata.clientHostName,
    },
  });

  revalidatePath(`/people/employees/${employeeId}`);
  return { status: "success", message: "Offboarding case opened." };
}

export async function markOnboardingTaskComplete(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const taskId = textValue(formData, "taskId");
  const employeeId = textValue(formData, "employeeId");

  await completeOnboardingTask({
    taskId,
    completedByUserId: actor.actor.userId,
    notes: textValue(formData, "notes") || null,
  });

  revalidatePath(`/people/employees/${employeeId}`);
  return { status: "success", message: "Onboarding task completed." };
}

export async function markOffboardingTaskComplete(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const taskId = textValue(formData, "taskId");
  const employeeId = textValue(formData, "employeeId");

  await completeOffboardingTask({
    taskId,
    completedByUserId: actor.actor.userId,
    notes: textValue(formData, "notes") || null,
  });

  revalidatePath(`/people/employees/${employeeId}`);
  return { status: "success", message: "Offboarding task completed." };
}

export async function cancelEmployeeOnboarding(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const caseId = textValue(formData, "caseId");
  const employeeId = textValue(formData, "employeeId");
  const notes = textValue(formData, "notes") || "Cancelled — started in error.";
  const metadata = await getAuditRequestMetadata(formData);

  try {
    const result = await cancelEmployeeOnboardingCase({
      caseId,
      cancelledByUserId: actor.actor.userId,
      notes,
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "CANCEL",
        entityType: "EmployeeOnboardingCase",
        entityId: caseId,
        description: "Cancelled employee onboarding case.",
        newValues: { notes },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    revalidatePath(`/people/employees/${result.employeeId || employeeId}`);
    return {
      status: "success",
      message: "Onboarding cancelled. You can start again if needed.",
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "ONBOARDING_CASE_NOT_CANCELLABLE"
        ? "This onboarding case is already completed or cancelled."
        : "Unable to cancel onboarding.";
    return { status: "error", message };
  }
}

export async function cancelEmployeeOffboarding(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const caseId = textValue(formData, "caseId");
  const employeeId = textValue(formData, "employeeId");
  const notes = textValue(formData, "notes") || "Cancelled — started in error.";
  const metadata = await getAuditRequestMetadata(formData);

  try {
    const result = await cancelEmployeeOffboardingCase({
      caseId,
      cancelledByUserId: actor.actor.userId,
      notes,
    });

    await prisma.auditEvent.create({
      data: {
        userId: actor.actor.userId,
        moduleKey: "hr",
        action: "CANCEL",
        entityType: "EmployeeOffboardingCase",
        entityId: caseId,
        description: "Cancelled employee offboarding case.",
        newValues: {
          notes,
          fileUnfrozen: result.fileUnfrozen,
          accessRevoked: result.accessRevoked,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        clientHostName: metadata.clientHostName,
      },
    });

    revalidatePath(`/people/employees/${result.employeeId || employeeId}`);

    if (result.accessRevoked) {
      return {
        status: "success",
        message:
          "Offboarding cancelled and file unfrozen if needed. Re-enable the user account in Access if it was already revoked.",
      };
    }

    return {
      status: "success",
      message: result.fileUnfrozen
        ? "Offboarding cancelled and employee file unfrozen."
        : "Offboarding cancelled. You can start again if needed.",
    };
  } catch (error) {
    const message =
      error instanceof Error &&
      error.message === "OFFBOARDING_CASE_NOT_CANCELLABLE"
        ? "This offboarding case is already completed or cancelled."
        : "Unable to cancel offboarding.";
    return { status: "error", message };
  }
}
