"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuditRequestMetadata } from "@/src/lib/audit-request-metadata";
import { requireActor } from "@/src/modules/auth/data/get-user-capabilities";
import {
  assignLifecycleTask,
  blockLifecycleTask,
  completeOffboardingTask,
  completeOnboardingTask,
  cancelEmployeeOffboardingCase,
  cancelEmployeeOnboardingCase,
  openEmployeeOffboardingCase,
  openEmployeeOnboardingCase,
  setLifecycleTaskDueAt,
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
  const proposedStartRaw = textValue(formData, "proposedStartDate");
  const caseTypeRaw = textValue(formData, "caseType");
  const opened = await openEmployeeOnboardingCase({
    organizationId: employee.organizationId,
    employeeId,
    openedByUserId: actor.actor.userId,
    notes: textValue(formData, "notes") || null,
    caseType:
      caseTypeRaw === "NEW_HIRE" ||
      caseTypeRaw === "REHIRE" ||
      caseTypeRaw === "CONTRACTOR" ||
      caseTypeRaw === "CONTINUING"
        ? caseTypeRaw
        : null,
    proposedStartDate: proposedStartRaw
      ? new Date(`${proposedStartRaw}T00:00:00.000Z`)
      : null,
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
  revalidatePath("/people/lifecycle");
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
  const reasonCodeRaw = textValue(formData, "reasonCode");
  const lastWorkingRaw = textValue(formData, "lastWorkingDate");
  const separationRaw = textValue(formData, "separationDate");
  const reasonCodes = [
    "RESIGNATION",
    "RETIREMENT",
    "END_OF_CONTRACT",
    "TERMINATION",
    "REDUNDANCY",
    "TRANSFER",
    "OTHER",
  ] as const;
  const reasonCode = reasonCodes.includes(
    reasonCodeRaw as (typeof reasonCodes)[number],
  )
    ? (reasonCodeRaw as (typeof reasonCodes)[number])
    : null;

  const opened = await openEmployeeOffboardingCase({
    organizationId: employee.organizationId,
    employeeId,
    openedByUserId: actor.actor.userId,
    reason: textValue(formData, "reason") || null,
    reasonCode,
    notes: textValue(formData, "notes") || null,
    lastWorkingDate: lastWorkingRaw
      ? new Date(`${lastWorkingRaw}T00:00:00.000Z`)
      : null,
    separationDate: separationRaw
      ? new Date(`${separationRaw}T00:00:00.000Z`)
      : null,
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
  revalidatePath("/people/lifecycle");
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
  revalidatePath("/people/lifecycle");
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
  const notes = textValue(formData, "notes");

  const task = await prisma.employeeOffboardingTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      code: true,
      case: {
        select: {
          employeeId: true,
          tasks: { select: { code: true, status: true } },
        },
      },
    },
  });

  if (!task || task.case.employeeId !== employeeId) {
    return { status: "error", message: "Offboarding task not found." };
  }

  if (task.code === "CLOSE_CONTRACT") {
    const stillActive = await prisma.employmentContract.findFirst({
      where: {
        employeeId,
        isCurrent: true,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (stillActive) {
      return {
        status: "error",
        message:
          "Close or expire the current active contract before marking this done.",
      };
    }
  }

  if (task.code === "FINAL_PAY_CHECK") {
    const contractClosed = task.case.tasks.some(
      (row) =>
        row.code === "CLOSE_CONTRACT" &&
        (row.status === "COMPLETED" || row.status === "SKIPPED"),
    );
    const stillActive = await prisma.employmentContract.findFirst({
      where: {
        employeeId,
        isCurrent: true,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!contractClosed && stillActive) {
      return {
        status: "error",
        message:
          "Close the employment contract (or mark Close contract done) before confirming final pay.",
      };
    }

    if (!notes) {
      return {
        status: "error",
        message:
          "Add a confirmation note (e.g. final pay run reference or “no further pay due”) before marking final pay checked.",
      };
    }
  }

  if (task.code === "REVOKE_ACCESS") {
    const fileFrozen = task.case.tasks.some(
      (row) =>
        row.code === "FREEZE_EMPLOYEE_FILE" && row.status === "COMPLETED",
    );
    if (!fileFrozen) {
      return {
        status: "error",
        message: "Freeze the employee file before revoking system access.",
      };
    }
  }

  await completeOffboardingTask({
    taskId,
    completedByUserId: actor.actor.userId,
    notes: notes || null,
  });

  revalidatePath(`/people/employees/${employeeId}`);
  revalidatePath("/people/lifecycle");
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
    revalidatePath("/people/lifecycle");
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
    revalidatePath("/people/lifecycle");

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

function parseLifecycleKind(
  raw: string,
): "onboarding" | "offboarding" | null {
  if (raw === "onboarding" || raw === "offboarding") {
    return raw;
  }
  return null;
}

export async function assignEmployeeLifecycleTask(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const kind = parseLifecycleKind(textValue(formData, "kind"));
  const taskId = textValue(formData, "taskId");
  const employeeId = textValue(formData, "employeeId");
  const assigneeRaw = textValue(formData, "assigneeUserId");
  const assigneeUserId =
    assigneeRaw === "" || assigneeRaw === "me"
      ? actor.actor.userId
      : assigneeRaw === "clear"
        ? null
        : assigneeRaw;

  if (!kind || !taskId || !employeeId) {
    return { status: "error", message: "Missing task details." };
  }

  try {
    await assignLifecycleTask({
      kind,
      taskId,
      employeeId,
      assigneeUserId,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "LIFECYCLE_TASK_NOT_FOUND") {
      return { status: "error", message: "Lifecycle task not found." };
    }
    if (code === "LIFECYCLE_ASSIGNEE_INVALID") {
      return { status: "error", message: "Assignee must be an active user." };
    }
    return { status: "error", message: "Unable to assign task." };
  }

  revalidatePath(`/people/employees/${employeeId}`);
  revalidatePath("/people/lifecycle");
  return {
    status: "success",
    message: assigneeUserId ? "Task assigned." : "Assignee cleared.",
  };
}

export async function setEmployeeLifecycleTaskDueDate(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const kind = parseLifecycleKind(textValue(formData, "kind"));
  const taskId = textValue(formData, "taskId");
  const employeeId = textValue(formData, "employeeId");
  const dueRaw = textValue(formData, "dueAt");

  if (!kind || !taskId || !employeeId) {
    return { status: "error", message: "Missing task details." };
  }

  const dueAt = dueRaw ? new Date(`${dueRaw}T23:59:59.000Z`) : null;
  if (dueRaw && Number.isNaN(dueAt?.getTime())) {
    return { status: "error", message: "Invalid due date." };
  }

  try {
    await setLifecycleTaskDueAt({
      kind,
      taskId,
      employeeId,
      dueAt,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "LIFECYCLE_TASK_NOT_FOUND"
    ) {
      return { status: "error", message: "Lifecycle task not found." };
    }
    return { status: "error", message: "Unable to set due date." };
  }

  revalidatePath(`/people/employees/${employeeId}`);
  revalidatePath("/people/lifecycle");
  return { status: "success", message: "Due date updated." };
}

export async function blockEmployeeLifecycleTask(
  _prev: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  const actor = await requireActor("people.manage");
  if (!actor.ok) {
    return { status: "error", message: actor.message };
  }

  const kind = parseLifecycleKind(textValue(formData, "kind"));
  const taskId = textValue(formData, "taskId");
  const employeeId = textValue(formData, "employeeId");
  const reason = textValue(formData, "reason");

  if (!kind || !taskId || !employeeId) {
    return { status: "error", message: "Missing task details." };
  }

  if (!reason) {
    return { status: "error", message: "A block reason is required." };
  }

  try {
    await blockLifecycleTask({
      kind,
      taskId,
      employeeId,
      reason,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "LIFECYCLE_TASK_NOT_FOUND") {
      return { status: "error", message: "Lifecycle task not found." };
    }
    if (code === "LIFECYCLE_TASK_NOT_BLOCKABLE") {
      return {
        status: "error",
        message: "Completed or skipped tasks cannot be blocked.",
      };
    }
    if (code === "LIFECYCLE_BLOCK_REASON_REQUIRED") {
      return { status: "error", message: "A block reason is required." };
    }
    return { status: "error", message: "Unable to block task." };
  }

  revalidatePath(`/people/employees/${employeeId}`);
  revalidatePath("/people/lifecycle");
  return { status: "success", message: "Task marked blocked." };
}
