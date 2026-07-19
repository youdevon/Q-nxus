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

  const task = await prisma.employeeOnboardingTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      code: true,
      case: {
        select: {
          employeeId: true,
        },
      },
    },
  });

  if (!task || task.case.employeeId !== employeeId) {
    return { status: "error", message: "Onboarding task not found." };
  }

  if (task.code === "CREATE_DRAFT_CONTRACT") {
    const draft = await prisma.employmentContract.findFirst({
      where: {
        employeeId,
        status: {
          in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "AWAITING_SIGNATURE"],
        },
      },
      select: { id: true },
    });

    if (!draft) {
      return {
        status: "error",
        message:
          "Create a draft contract first (or submit one for approval), then mark this done.",
      };
    }
  }

  if (task.code === "ACTIVATE_CONTRACT") {
    const active = await prisma.employmentContract.findFirst({
      where: {
        employeeId,
        isCurrent: true,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!active) {
      return {
        status: "error",
        message:
          "Activate an employment contract on the contract page before marking this done.",
      };
    }
  }

  if (task.code === "PAYROLL_READINESS") {
    const { getEmployeePayrollSetup } = await import(
      "@/src/modules/payroll/data/get-employee-payroll-setup"
    );
    const setup = await getEmployeePayrollSetup(employeeId);
    const ready = setup?.readiness?.isReady === true;

    if (!ready) {
      const issues =
        setup?.readiness?.blockingIssues?.slice(0, 3).join("; ") ||
        "Payroll setup is not ready.";
      return {
        status: "error",
        message: `Payroll is not ready yet: ${issues}`,
      };
    }
  }

  if (task.code === "COMPLETE_REQUIRED_DOCS") {
    const { getEmployeeFileChecklist } = await import(
      "@/src/modules/hr/data/get-employee-file-checklist"
    );
    const { assessStandingEmployeeFileDocs } = await import(
      "@/src/modules/hr/lib/employee-file-checklist"
    );
    const checklist = await getEmployeeFileChecklist(employeeId);
    const standing = assessStandingEmployeeFileDocs(checklist?.items ?? []);

    if (!standing.standingDocsComplete) {
      return {
        status: "error",
        message: `Standing file documents still missing: ${standing.missingLabels.join(", ") || "required items"}.`,
      };
    }
  }

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
