import type {
  OffboardingCaseReason,
  OnboardingCaseType,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  defaultLifecycleTaskDueAt,
  isLifecycleCaseAtRisk,
  lifecycleTaskProgress,
} from "@/src/modules/hr/lib/lifecycle-progress";
import {
  resolveTasksForOffboardingCase,
  resolveTasksForOnboardingCase,
} from "@/src/modules/hr/services/employee-lifecycle-templates";

export { lifecycleTaskProgress };

type Tx = Prisma.TransactionClient | typeof prisma;

async function allocateLifecycleCaseNumber(
  client: Tx,
  organizationId: string,
  prefix: "ONB" | "OFB",
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const count =
    prefix === "ONB"
      ? await client.employeeOnboardingCase.count({ where: { organizationId } })
      : await client.employeeOffboardingCase.count({
          where: { organizationId },
        });

  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}

function resolveOnboardingCaseType(
  priorContractCount: number,
  requested?: OnboardingCaseType | null,
): OnboardingCaseType {
  if (requested) {
    return requested;
  }
  return priorContractCount > 0 ? "CONTINUING" : "NEW_HIRE";
}

export async function openEmployeeOnboardingCase(input: {
  organizationId: string;
  employeeId: string;
  openedByUserId: string | null;
  notes?: string | null;
  caseType?: OnboardingCaseType | null;
  proposedStartDate?: Date | null;
  confirmedStartDate?: Date | null;
  ownerUserId?: string | null;
  client?: Tx;
}) {
  const client = input.client ?? prisma;

  const existing = await client.employeeOnboardingCase.findFirst({
    where: {
      employeeId: input.employeeId,
      status: { in: ["OPEN", "READY"] },
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const [employee, priorContractCount] = await Promise.all([
    client.employee.findUnique({
      where: { id: input.employeeId },
      select: {
        workforceCategory: true,
        nisNumber: true,
        birNumber: true,
      },
    }),
    client.employmentContract.count({
      where: { employeeId: input.employeeId },
    }),
  ]);

  const continuingEmployee = priorContractCount > 0;
  const caseType = resolveOnboardingCaseType(
    priorContractCount,
    input.caseType,
  );
  const caseNumber = await allocateLifecycleCaseNumber(
    client,
    input.organizationId,
    "ONB",
  );
  const caseNotes = [
    input.notes?.trim() || null,
    continuingEmployee
      ? "Continuing employee: standing file documents may already be on file from a prior contract."
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const templateTasks = await resolveTasksForOnboardingCase({
    organizationId: input.organizationId,
    caseType,
    client,
  });

  const ownerUserId = input.ownerUserId ?? input.openedByUserId;
  const openedAt = new Date();
  const defaultDueAt = defaultLifecycleTaskDueAt(openedAt);

  const created = await client.employeeOnboardingCase.create({
    data: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      caseNumber,
      caseType,
      openedByUserId: input.openedByUserId,
      ownerUserId,
      proposedStartDate: input.proposedStartDate ?? null,
      confirmedStartDate: input.confirmedStartDate ?? null,
      openedAt,
      notes: caseNotes || null,
      tasks: {
        create: templateTasks.map((task) => ({
          code: task.code,
          label: task.label,
          sortOrder: task.sortOrder,
          assigneeUserId: ownerUserId ?? null,
          dueAt: (task.mandatory ?? true) ? defaultDueAt : null,
        })),
      },
    },
    select: {
      id: true,
      tasks: { select: { id: true, code: true } },
    },
  });

  await applyExistingFileStateToOnboardingCase({
    caseId: created.id,
    organizationId: input.organizationId,
    employeeId: input.employeeId,
    workforceCategory: employee?.workforceCategory ?? null,
    openedByUserId: input.openedByUserId,
    continuingEmployee,
    hasNis: Boolean(employee?.nisNumber?.trim()),
    hasBir: Boolean(employee?.birNumber?.trim()),
    client,
  });

  return { id: created.id };
}

/**
 * Seed checklist slots and auto-complete file tasks that are already satisfied
 * for continuing employees (ID, birth cert, etc. carry across contracts).
 * Assumption of duty stays pending — often needed for a new engagement.
 */
async function applyExistingFileStateToOnboardingCase(input: {
  caseId: string;
  organizationId: string;
  employeeId: string;
  workforceCategory: import("@/generated/prisma/client").WorkforceCategory | null;
  openedByUserId: string | null;
  continuingEmployee: boolean;
  hasNis: boolean;
  hasBir: boolean;
  client: Tx;
}) {
  const { seedChecklistFromPack } = await import(
    "@/src/modules/hr/services/employee-file-packs"
  );
  const { getEmployeeFileChecklist } = await import(
    "@/src/modules/hr/data/get-employee-file-checklist"
  );
  const { assessStandingEmployeeFileDocs } = await import(
    "@/src/modules/hr/lib/employee-file-checklist"
  );

  await seedChecklistFromPack({
    organizationId: input.organizationId,
    employeeId: input.employeeId,
    workforceCategory: input.workforceCategory,
  });

  const checklist = await getEmployeeFileChecklist(input.employeeId);
  const standing = assessStandingEmployeeFileDocs(checklist?.items ?? []);
  const completedAt = new Date();
  const actorId = input.openedByUserId;

  const seedTask = await input.client.employeeOnboardingTask.findFirst({
    where: { caseId: input.caseId, code: "SEED_FILE_CHECKLIST" },
    select: { id: true },
  });

  if (seedTask) {
    await input.client.employeeOnboardingTask.update({
      where: { id: seedTask.id },
      data: {
        status: "COMPLETED",
        completedAt,
        completedByUserId: actorId,
        notes: input.continuingEmployee
          ? "Checklist seeded; existing employee-file slots preserved."
          : "Checklist seeded from the default document pack.",
      },
    });
  }

  if (standing.standingDocsComplete) {
    const docsTask = await input.client.employeeOnboardingTask.findFirst({
      where: { caseId: input.caseId, code: "COMPLETE_REQUIRED_DOCS" },
      select: { id: true },
    });

    if (docsTask) {
      const statutoryNote =
        input.hasNis && input.hasBir
          ? " NIS and BIR are already on the employee record."
          : input.hasNis || input.hasBir
            ? ` ${input.hasNis ? "NIS" : "BIR"} is on file; confirm the other statutory number if required for payroll.`
            : " Confirm NIS/BIR on the employee record before payroll readiness.";

      await input.client.employeeOnboardingTask.update({
        where: { id: docsTask.id },
        data: {
          status: "COMPLETED",
          completedAt,
          completedByUserId: actorId,
          notes: `Standing file documents already on file from prior employment.${statutoryNote} Assumption of duty remains a separate task if a new letter is required.`,
        },
      });
    }
  } else if (standing.missingLabels.length > 0) {
    const docsTask = await input.client.employeeOnboardingTask.findFirst({
      where: { caseId: input.caseId, code: "COMPLETE_REQUIRED_DOCS" },
      select: { id: true },
    });

    if (docsTask) {
      await input.client.employeeOnboardingTask.update({
        where: { id: docsTask.id },
        data: {
          notes: `Still missing: ${standing.missingLabels.join(", ")}.`,
        },
      });
    }
  }
}

export async function openEmployeeOffboardingCase(input: {
  organizationId: string;
  employeeId: string;
  openedByUserId: string | null;
  reason?: string | null;
  reasonCode?: OffboardingCaseReason | null;
  notes?: string | null;
  lastWorkingDate?: Date | null;
  separationDate?: Date | null;
  ownerUserId?: string | null;
  client?: Tx;
}) {
  const client = input.client ?? prisma;

  const existing = await client.employeeOffboardingCase.findFirst({
    where: {
      employeeId: input.employeeId,
      status: { in: ["OPEN", "CLEARED"] },
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const caseNumber = await allocateLifecycleCaseNumber(
    client,
    input.organizationId,
    "OFB",
  );

  const templateTasks = await resolveTasksForOffboardingCase({
    organizationId: input.organizationId,
    reasonCode: input.reasonCode ?? null,
    client,
  });

  const ownerUserId = input.ownerUserId ?? input.openedByUserId;
  const openedAt = new Date();
  const defaultDueAt = defaultLifecycleTaskDueAt(openedAt);

  return client.employeeOffboardingCase.create({
    data: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      caseNumber,
      openedByUserId: input.openedByUserId,
      ownerUserId,
      reason: input.reason ?? null,
      reasonCode: input.reasonCode ?? null,
      lastWorkingDate: input.lastWorkingDate ?? null,
      separationDate: input.separationDate ?? null,
      openedAt,
      notes: input.notes ?? null,
      tasks: {
        create: templateTasks.map((task) => ({
          code: task.code,
          label: task.label,
          sortOrder: task.sortOrder,
          assigneeUserId: ownerUserId ?? null,
          dueAt: (task.mandatory ?? true) ? defaultDueAt : null,
        })),
      },
    },
    select: { id: true },
  });
}

export async function completeOnboardingTask(input: {
  taskId: string;
  completedByUserId: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  notes?: string | null;
}) {
  const task = await prisma.employeeOnboardingTask.update({
    where: { id: input.taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedByUserId: input.completedByUserId,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      notes: input.notes ?? null,
    },
    select: {
      code: true,
      caseId: true,
      case: {
        select: {
          employeeId: true,
          organizationId: true,
          tasks: { select: { status: true, code: true } },
          employee: {
            select: {
              workforceCategory: true,
            },
          },
        },
      },
    },
  });

  if (task.code === "SEED_FILE_CHECKLIST") {
    const { seedChecklistFromPack } = await import(
      "@/src/modules/hr/services/employee-file-packs"
    );
    await seedChecklistFromPack({
      organizationId: task.case.organizationId,
      employeeId: task.case.employeeId,
      workforceCategory: task.case.employee.workforceCategory,
    });
  }

  const taskStatuses = task.case.tasks.map((row) =>
    row.code === task.code ? { ...row, status: "COMPLETED" as const } : row,
  );

  const allDone = taskStatuses.every(
    (row) => row.status === "COMPLETED" || row.status === "SKIPPED",
  );
  const contractActive = taskStatuses.some(
    (row) => row.code === "ACTIVATE_CONTRACT" && row.status === "COMPLETED",
  );
  const docsDone = taskStatuses.some(
    (row) =>
      row.code === "COMPLETE_REQUIRED_DOCS" && row.status === "COMPLETED",
  );

  if (contractActive && docsDone) {
    await prisma.employeeOnboardingCase.update({
      where: { id: task.caseId },
      data: {
        status: allDone ? "COMPLETED" : "READY",
        readyAt: new Date(),
        completedAt: allDone ? new Date() : null,
      },
    });
  }

  return task;
}

export async function completeOffboardingTask(input: {
  taskId: string;
  completedByUserId: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  notes?: string | null;
}) {
  const task = await prisma.employeeOffboardingTask.update({
    where: { id: input.taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedByUserId: input.completedByUserId,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      notes: input.notes ?? null,
    },
    select: {
      code: true,
      caseId: true,
      case: {
        select: {
          employeeId: true,
          tasks: { select: { status: true, code: true } },
        },
      },
    },
  });

  if (task.code === "FREEZE_EMPLOYEE_FILE") {
    await prisma.employee.update({
      where: { id: task.case.employeeId },
      data: { fileFrozenAt: new Date() },
    });
  }

  if (task.code === "REVOKE_ACCESS") {
    await prisma.user.updateMany({
      where: { employeeId: task.case.employeeId },
      data: { isActive: false, status: "DISABLED" },
    });
  }

  const allDone = task.case.tasks.every(
    (row) => row.status === "COMPLETED" || row.status === "SKIPPED",
  );

  if (allDone) {
    await prisma.employeeOffboardingCase.update({
      where: { id: task.caseId },
      data: {
        status: "COMPLETED",
        clearedAt: new Date(),
        completedAt: new Date(),
      },
    });
  } else {
    const criticalDone = task.case.tasks
      .filter((row) =>
        ["CLOSE_CONTRACT", "FREEZE_EMPLOYEE_FILE", "REVOKE_ACCESS"].includes(
          row.code,
        ),
      )
      .every((row) => row.status === "COMPLETED" || row.status === "SKIPPED");

    if (criticalDone) {
      await prisma.employeeOffboardingCase.update({
        where: { id: task.caseId },
        data: { status: "CLEARED", clearedAt: new Date() },
      });
    }
  }

  return task;
}

export async function getEmployeeLifecycleCases(employeeId: string) {
  const [onboarding, offboarding] = await Promise.all([
    prisma.employeeOnboardingCase.findMany({
      where: { employeeId },
      orderBy: { openedAt: "desc" },
      include: {
        tasks: {
          orderBy: { sortOrder: "asc" },
          include: {
            assignee: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    }),
    prisma.employeeOffboardingCase.findMany({
      where: { employeeId },
      orderBy: { openedAt: "desc" },
      include: {
        tasks: {
          orderBy: { sortOrder: "asc" },
          include: {
            assignee: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    }),
  ]);

  return { onboarding, offboarding };
}

/**
 * Cancel an open/ready onboarding case started in error.
 * Does not delete historical completed tasks; marks remaining pending work skipped.
 */
export async function cancelEmployeeOnboardingCase(input: {
  caseId: string;
  cancelledByUserId: string;
  notes?: string | null;
}) {
  const existing = await prisma.employeeOnboardingCase.findUnique({
    where: { id: input.caseId },
    select: {
      id: true,
      status: true,
      employeeId: true,
    },
  });

  if (!existing) {
    throw new Error("ONBOARDING_CASE_NOT_FOUND");
  }

  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    throw new Error("ONBOARDING_CASE_NOT_CANCELLABLE");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeOnboardingTask.updateMany({
      where: {
        caseId: input.caseId,
        status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
      },
      data: {
        status: "SKIPPED",
        completedAt: new Date(),
        completedByUserId: input.cancelledByUserId,
        notes: input.notes ?? "Skipped because onboarding was cancelled.",
      },
    });

    await transaction.employeeOnboardingCase.update({
      where: { id: input.caseId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledReason: input.notes ?? "Cancelled.",
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });
  });

  return { employeeId: existing.employeeId };
}

/**
 * Cancel an open/cleared offboarding case started in error.
 * Clears file freeze if the freeze task had already been completed.
 * Does not automatically re-enable a revoked user account.
 */
export async function cancelEmployeeOffboardingCase(input: {
  caseId: string;
  cancelledByUserId: string;
  notes?: string | null;
}) {
  const existing = await prisma.employeeOffboardingCase.findUnique({
    where: { id: input.caseId },
    select: {
      id: true,
      status: true,
      employeeId: true,
      tasks: {
        select: {
          code: true,
          status: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("OFFBOARDING_CASE_NOT_FOUND");
  }

  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    throw new Error("OFFBOARDING_CASE_NOT_CANCELLABLE");
  }

  const freezeDone = existing.tasks.some(
    (task) =>
      task.code === "FREEZE_EMPLOYEE_FILE" && task.status === "COMPLETED",
  );
  const accessRevoked = existing.tasks.some(
    (task) => task.code === "REVOKE_ACCESS" && task.status === "COMPLETED",
  );

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeOffboardingTask.updateMany({
      where: {
        caseId: input.caseId,
        status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
      },
      data: {
        status: "SKIPPED",
        completedAt: new Date(),
        completedByUserId: input.cancelledByUserId,
        notes: input.notes ?? "Skipped because offboarding was cancelled.",
      },
    });

    await transaction.employeeOffboardingCase.update({
      where: { id: input.caseId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledReason: input.notes ?? "Cancelled.",
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });

    if (freezeDone) {
      await transaction.employee.update({
        where: { id: existing.employeeId },
        data: { fileFrozenAt: null },
      });
    }
  });

  return {
    employeeId: existing.employeeId,
    accessRevoked,
    fileUnfrozen: freezeDone,
  };
}

export type OrgLifecycleQueueItem = {
  kind: "onboarding" | "offboarding";
  caseId: string;
  caseNumber: string | null;
  status: string;
  caseTypeOrReason: string | null;
  progressPercent: number;
  atRisk: boolean;
  openedAt: Date;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  ownerName: string | null;
};

export async function getOrgLifecycleQueue(
  organizationId: string,
  limit = 50,
): Promise<OrgLifecycleQueueItem[]> {
  const [onboarding, offboarding] = await Promise.all([
    prisma.employeeOnboardingCase.findMany({
      where: {
        organizationId,
        status: { in: ["OPEN", "READY"] },
      },
      orderBy: { openedAt: "asc" },
      take: limit,
      select: {
        id: true,
        caseNumber: true,
        caseType: true,
        status: true,
        openedAt: true,
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            preferredName: true,
          },
        },
        owner: {
          select: { firstName: true, lastName: true },
        },
        tasks: { select: { status: true, dueAt: true } },
      },
    }),
    prisma.employeeOffboardingCase.findMany({
      where: {
        organizationId,
        status: { in: ["OPEN", "CLEARED"] },
      },
      orderBy: { openedAt: "asc" },
      take: limit,
      select: {
        id: true,
        caseNumber: true,
        reasonCode: true,
        reason: true,
        status: true,
        openedAt: true,
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            preferredName: true,
          },
        },
        owner: {
          select: { firstName: true, lastName: true },
        },
        tasks: { select: { status: true, dueAt: true } },
      },
    }),
  ]);

  const now = new Date();
  const items: OrgLifecycleQueueItem[] = [
    ...onboarding.map((row) => ({
      kind: "onboarding" as const,
      caseId: row.id,
      caseNumber: row.caseNumber,
      status: row.status,
      caseTypeOrReason: row.caseType,
      progressPercent: lifecycleTaskProgress(row.tasks),
      atRisk: isLifecycleCaseAtRisk(row.tasks, now),
      openedAt: row.openedAt,
      employeeId: row.employee.id,
      employeeNumber: row.employee.employeeNumber,
      employeeName:
        `${row.employee.preferredName ?? row.employee.firstName} ${row.employee.lastName}`.trim(),
      ownerName: row.owner
        ? `${row.owner.firstName} ${row.owner.lastName}`.trim()
        : null,
    })),
    ...offboarding.map((row) => ({
      kind: "offboarding" as const,
      caseId: row.id,
      caseNumber: row.caseNumber,
      status: row.status,
      caseTypeOrReason: row.reasonCode ?? row.reason,
      progressPercent: lifecycleTaskProgress(row.tasks),
      atRisk: isLifecycleCaseAtRisk(row.tasks, now),
      openedAt: row.openedAt,
      employeeId: row.employee.id,
      employeeNumber: row.employee.employeeNumber,
      employeeName:
        `${row.employee.preferredName ?? row.employee.firstName} ${row.employee.lastName}`.trim(),
      ownerName: row.owner
        ? `${row.owner.firstName} ${row.owner.lastName}`.trim()
        : null,
    })),
  ];

  items.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
  return items.slice(0, limit);
}

type LifecycleTaskKind = "onboarding" | "offboarding";

async function findLifecycleTaskForEmployee(
  kind: LifecycleTaskKind,
  taskId: string,
  employeeId: string,
) {
  if (kind === "onboarding") {
    const task = await prisma.employeeOnboardingTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        case: { select: { employeeId: true } },
      },
    });
    if (!task || task.case.employeeId !== employeeId) {
      return null;
    }
    return task;
  }

  const task = await prisma.employeeOffboardingTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      case: { select: { employeeId: true } },
    },
  });
  if (!task || task.case.employeeId !== employeeId) {
    return null;
  }
  return task;
}

export async function assignLifecycleTask(input: {
  kind: LifecycleTaskKind;
  taskId: string;
  employeeId: string;
  assigneeUserId: string | null;
}) {
  const existing = await findLifecycleTaskForEmployee(
    input.kind,
    input.taskId,
    input.employeeId,
  );
  if (!existing) {
    throw new Error("LIFECYCLE_TASK_NOT_FOUND");
  }

  if (input.assigneeUserId) {
    const user = await prisma.user.findUnique({
      where: { id: input.assigneeUserId },
      select: { id: true, isActive: true },
    });
    if (!user?.isActive) {
      throw new Error("LIFECYCLE_ASSIGNEE_INVALID");
    }
  }

  const data = { assigneeUserId: input.assigneeUserId };
  if (input.kind === "onboarding") {
    return prisma.employeeOnboardingTask.update({
      where: { id: input.taskId },
      data,
      select: { id: true, assigneeUserId: true },
    });
  }

  return prisma.employeeOffboardingTask.update({
    where: { id: input.taskId },
    data,
    select: { id: true, assigneeUserId: true },
  });
}

export async function setLifecycleTaskDueAt(input: {
  kind: LifecycleTaskKind;
  taskId: string;
  employeeId: string;
  dueAt: Date | null;
}) {
  const existing = await findLifecycleTaskForEmployee(
    input.kind,
    input.taskId,
    input.employeeId,
  );
  if (!existing) {
    throw new Error("LIFECYCLE_TASK_NOT_FOUND");
  }

  const data = { dueAt: input.dueAt };
  if (input.kind === "onboarding") {
    return prisma.employeeOnboardingTask.update({
      where: { id: input.taskId },
      data,
      select: { id: true, dueAt: true },
    });
  }

  return prisma.employeeOffboardingTask.update({
    where: { id: input.taskId },
    data,
    select: { id: true, dueAt: true },
  });
}

export async function blockLifecycleTask(input: {
  kind: LifecycleTaskKind;
  taskId: string;
  employeeId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("LIFECYCLE_BLOCK_REASON_REQUIRED");
  }

  const existing = await findLifecycleTaskForEmployee(
    input.kind,
    input.taskId,
    input.employeeId,
  );
  if (!existing) {
    throw new Error("LIFECYCLE_TASK_NOT_FOUND");
  }

  if (
    existing.status === "COMPLETED" ||
    existing.status === "SKIPPED"
  ) {
    throw new Error("LIFECYCLE_TASK_NOT_BLOCKABLE");
  }

  const data = {
    status: "BLOCKED" as const,
    notes: reason,
  };

  if (input.kind === "onboarding") {
    return prisma.employeeOnboardingTask.update({
      where: { id: input.taskId },
      data,
      select: { id: true, status: true, notes: true },
    });
  }

  return prisma.employeeOffboardingTask.update({
    where: { id: input.taskId },
    data,
    select: { id: true, status: true, notes: true },
  });
}

